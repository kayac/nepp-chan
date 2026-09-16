import { DurableObject } from "cloudflare:workers";
import { logger } from "~/lib/logger";
import { LIVE_MODEL, LIVE_VOICE, liveInstructions } from "./live-instructions";
import {
  commentaryAppendMessage,
  inputAudioAppendMessage,
  parseLiveEvent,
  parseStreamEvent,
  serializeLiveMessage,
  serializeStreamMessage,
  sessionCloseMessage,
  sessionStartMessage,
  streamMediaMessage,
} from "./live-protocol";
import { verifySetupToken } from "./twilio-token";

const SETUP_TIMEOUT_MS = 15_000;

// Workers の fetch は wss: スキームを受け付けないため https: に Upgrade ヘッダを添える。
const LIVE_ENDPOINT = "https://api.openai.com/v1/live/sessions";

const DELEGATION_STUB = "ごめんね、それは今ちょっと分からないや。";

const CLOSE_GRACE_MS = 3_000;

export const handleLiveUpgrade = (
  request: Request,
  env: CloudflareBindings,
) => {
  const id = env.LIVE_BRIDGE.newUniqueId();
  return env.LIVE_BRIDGE.get(id).fetch(request);
};

export class LiveBridge extends DurableObject<CloudflareBindings> {
  private twilio: WebSocket | null = null;
  private live: WebSocket | null = null;
  private streamSid = "";
  private sessionStarted = false;
  private closing = false;
  private closeRequested = false;
  private resolveClosed: (() => void) | null = null;
  private droppedInboundFrames = 0;
  private delegationCount = 0;

  async fetch() {
    const { 0: client, 1: server } = new WebSocketPair();
    this.twilio = server;
    server.accept();
    server.addEventListener("message", (event) => {
      this.ctx.waitUntil(
        this.onTwilioMessage(event).catch((e) =>
          logger.error("[LiveBridge] twilio message failed", {
            error: e instanceof Error ? e.message : String(e),
          }),
        ),
      );
    });
    server.addEventListener("close", () => {
      logger.info("[LiveBridge] twilio socket closed");
      this.ctx.waitUntil(this.finishLiveSession());
    });
    await this.ctx.storage.setAlarm(Date.now() + SETUP_TIMEOUT_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  async alarm() {
    if (this.streamSid && this.sessionStarted) return;
    logger.warn("[LiveBridge] not ready within timeout, closing", {
      hasStreamSid: this.streamSid !== "",
      sessionStarted: this.sessionStarted,
    });
    this.twilio?.close(1008, "setup timeout");
    this.shutdown();
  }

  private async onTwilioMessage(event: MessageEvent) {
    if (typeof event.data !== "string") return;
    const msg = parseStreamEvent(event.data);
    if (!msg) return;

    if (msg.event === "media") {
      if (!this.live || !this.sessionStarted) {
        this.droppedInboundFrames++;
        return;
      }
      this.live.send(
        serializeLiveMessage(inputAudioAppendMessage(msg.media.payload)),
      );
      return;
    }

    logger.info("[LiveBridge] twilio event", { event: msg.event });

    if (msg.event === "start") {
      const claims = await verifySetupToken(
        msg.start.customParameters,
        this.env.CALL_TOKEN_SECRET,
      );
      if (!claims) {
        logger.warn("[LiveBridge] invalid token on start, closing");
        this.twilio?.close(1008, "invalid token");
        this.shutdown();
        return;
      }
      this.streamSid = msg.streamSid;
      logger.info("[LiveBridge] stream started", {
        callSid: msg.start.callSid,
        customParameterKeys: Object.keys(msg.start.customParameters ?? {}).join(
          ",",
        ),
      });
      await this.connectLive();
    } else if (msg.event === "stop") {
      await this.finishLiveSession();
    }
  }

  private async connectLive() {
    const response = await fetch(LIVE_ENDPOINT, {
      headers: {
        Upgrade: "websocket",
        Authorization: `Bearer ${this.env.OPENAI_API_KEY}`,
        "User-Agent": "nepp-chan-live-spike/1.0",
      },
    });
    const socket = response.webSocket;
    if (!socket) {
      logger.error("[LiveBridge] live upgrade failed", {
        status: response.status,
        body: (await response.text()).slice(0, 500),
      });
      this.twilio?.close(1011, "live upgrade failed");
      this.shutdown();
      return;
    }

    if (this.closing || this.closeRequested) {
      logger.info("[LiveBridge] call ended while connecting, closing live");
      socket.accept();
      socket.close(1000, "call ended");
      return;
    }

    this.live = socket;
    socket.accept();
    socket.addEventListener("message", (event) => {
      this.onLiveMessage(event);
    });
    socket.addEventListener("close", (event) => {
      logger.info("[LiveBridge] live socket closed", {
        code: event.code,
        reason: event.reason,
      });
      this.resolveClosed?.();
      this.shutdown();
    });
    socket.addEventListener("error", () => {
      logger.error("[LiveBridge] live socket error");
      this.resolveClosed?.();
      this.shutdown();
    });
    socket.send(
      serializeLiveMessage(
        sessionStartMessage({
          model: LIVE_MODEL,
          instructions: liveInstructions,
          voice: LIVE_VOICE,
        }),
      ),
    );
  }

  private onLiveMessage(event: MessageEvent) {
    if (typeof event.data !== "string") return;
    const msg = parseLiveEvent(event.data);
    if (!msg) return;

    if (msg.type === "session.output_audio.delta") {
      if (!this.streamSid) return;
      this.twilio?.send(
        serializeStreamMessage(streamMediaMessage(this.streamSid, msg.delta)),
      );
      return;
    }

    if (msg.type === "session.started") {
      this.sessionStarted = true;
      logger.info("[LiveBridge] session started", {
        droppedInboundFrames: this.droppedInboundFrames,
      });
    } else if (msg.type === "session.input_transcript.delta") {
      logger.info("[LiveBridge] user transcript", { delta: msg.delta });
    } else if (msg.type === "session.output_transcript.delta") {
      logger.info("[LiveBridge] nepp transcript", { delta: msg.delta });
    } else if (msg.type === "session.delegation.created") {
      this.delegationCount++;
      logger.info("[LiveBridge] delegation created", {
        id: msg.delegation.id,
        target: msg.delegation.target ?? "",
        offsetMs: msg.offset_ms ?? -1,
        count: this.delegationCount,
      });
      this.live?.send(
        serializeLiveMessage(
          commentaryAppendMessage(msg.delegation.id, DELEGATION_STUB),
        ),
      );
    } else if (msg.type === "session.closed") {
      logger.info("[LiveBridge] session closed", {
        usage: JSON.stringify(msg.usage ?? null),
        delegationCount: this.delegationCount,
      });
      this.resolveClosed?.();
      this.shutdown();
    } else if (msg.type === "error") {
      logger.error("[LiveBridge] live error", {
        raw: event.data.slice(0, 500),
      });
    }
  }

  // Twilio 側が閉じても session.closed の usage を取りこぼさないよう、
  // 最終イベントが届くまで DO を生かしたまま待つ。
  private async finishLiveSession() {
    if (this.closeRequested) return;
    this.closeRequested = true;
    if (!this.live || !this.sessionStarted) {
      this.shutdown();
      return;
    }
    this.live.send(serializeLiveMessage(sessionCloseMessage()));
    await new Promise<void>((resolve) => {
      this.resolveClosed = resolve;
      setTimeout(resolve, CLOSE_GRACE_MS);
    });
    this.shutdown();
  }

  private shutdown() {
    if (this.closing) return;
    this.closing = true;
    this.live?.close(1000, "bridge shutdown");
    this.twilio?.close(1000, "bridge shutdown");
  }
}
