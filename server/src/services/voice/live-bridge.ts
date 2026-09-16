import { DurableObject } from "cloudflare:workers";
import { logger } from "~/lib/logger";
import { createVoiceConversation } from "./conversation";
import { buildChimeFrames } from "./live-chime";
import {
  buildLiveInstructions,
  LIVE_MODEL,
  parseLiveVoice,
} from "./live-instructions";
import { createDelegationProgress } from "./live-progress";
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
import {
  reconstructQuestion,
  type TranscriptFragment,
} from "./live-transcript";
import { verifySetupToken } from "./twilio-token";

const SETUP_TIMEOUT_MS = 15_000;

// Workers の fetch は wss: スキームを受け付けないため https: に Upgrade ヘッダを添える。
const LIVE_ENDPOINT = "https://api.openai.com/v1/live/sessions";

const DELEGATION_FALLBACK = "うまく調べられなかった。";

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
  private from = "";
  private callSid = "";
  private knowledgeEnabled = true;
  private voice = parseLiveVoice(undefined);
  private sessionStarted = false;
  private closing = false;
  private closeRequested = false;
  private resolveClosed: (() => void) | null = null;
  private droppedInboundFrames = 0;
  private sentInboundFrames = 0;
  private outputFrames = 0;
  private nonSilentOutputFrames = 0;
  private delegationCount = 0;
  private inputFragments: TranscriptFragment[] = [];
  private lastOutputEndMs = 0;
  private lastDelegationOffsetMs = 0;
  private currentTurn: AbortController | null = null;
  private conversationPromise: ReturnType<
    typeof createVoiceConversation
  > | null = null;

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
      this.sentInboundFrames++;
      if (this.sentInboundFrames === 1) {
        logger.info("[LiveBridge] first audio frame sent", {
          payloadLength: msg.media.payload.length,
        });
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
      this.callSid = msg.start.callSid;
      this.from = msg.start.customParameters?.from ?? "";
      this.knowledgeEnabled = msg.start.customParameters?.knowledge !== "false";
      this.voice = parseLiveVoice(msg.start.customParameters?.liveVoice);
      logger.info("[LiveBridge] stream started", {
        callSid: msg.start.callSid,
        knowledgeEnabled: this.knowledgeEnabled,
        voice: this.voice,
        customParameterKeys: Object.keys(msg.start.customParameters ?? {}).join(
          ",",
        ),
      });
      this.sendChime();
      await this.connectLive();
    } else if (msg.event === "stop") {
      await this.finishLiveSession();
    }
  }

  // GPT-Live は指示があっても自分から挨拶しないことがあるため、つながったことを
  // 音で知らせて相手が話し始められるようにする。
  private sendChime() {
    const frames = buildChimeFrames();
    for (const frame of frames) {
      this.twilio?.send(
        serializeStreamMessage(streamMediaMessage(this.streamSid, frame)),
      );
    }
    logger.info("[LiveBridge] chime sent", { frames: frames.length });
  }

  private async connectLive() {
    const response = await fetch(LIVE_ENDPOINT, {
      headers: {
        Upgrade: "websocket",
        Authorization: `Bearer ${this.env.OPENAI_LIVE_API_KEY}`,
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
          instructions: buildLiveInstructions(this.knowledgeEnabled),
          voice: this.voice,
        }),
      ),
    );
  }

  private onLiveMessage(event: MessageEvent) {
    if (typeof event.data !== "string") return;
    if (!event.data.includes('"session.output_audio.delta"')) {
      logger.info("[LiveBridge] raw live event", {
        raw: event.data.slice(0, 2500),
      });
    }
    const msg = parseLiveEvent(event.data);
    if (!msg) return;

    if (msg.type === "session.output_audio.delta") {
      if (!this.streamSid) return;
      this.outputFrames++;
      if (/[^/=]/.test(msg.delta)) this.nonSilentOutputFrames++;
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
      this.inputFragments.push({
        text: msg.delta,
        startMs: msg.start_ms,
        endMs: msg.end_ms,
      });
    } else if (msg.type === "session.output_transcript.delta") {
      logger.info("[LiveBridge] nepp transcript", { delta: msg.delta });
      const end = msg.end_ms ?? msg.start_ms;
      if (end !== undefined) {
        this.lastOutputEndMs = Math.max(this.lastOutputEndMs, end);
      }
    } else if (msg.type === "session.delegation.created") {
      this.delegationCount++;
      const offsetMs = msg.offset_ms ?? Number.POSITIVE_INFINITY;
      this.ctx.waitUntil(
        this.handleDelegation(msg.delegation.id, offsetMs).catch((e) =>
          logger.error("[LiveBridge] delegation failed", {
            error: e instanceof Error ? e.message : String(e),
          }),
        ),
      );
    } else if (msg.type === "session.closed") {
      logger.info("[LiveBridge] session closed", {
        usage: JSON.stringify(msg.usage ?? null),
        delegationCount: this.delegationCount,
        sentInboundFrames: this.sentInboundFrames,
        outputFrames: this.outputFrames,
        nonSilentOutputFrames: this.nonSilentOutputFrames,
      });
      this.resolveClosed?.();
      this.shutdown();
    } else if (msg.type === "error") {
      logger.error("[LiveBridge] live error", {
        raw: event.data.slice(0, 500),
      });
    }
  }

  private async handleDelegation(delegationId: string, offsetMs: number) {
    const startedAt = Date.now();
    if (!this.knowledgeEnabled) {
      logger.info("[LiveBridge] delegation suppressed", {
        id: delegationId,
        count: this.delegationCount,
      });
      this.sendCommentary(delegationId, DELEGATION_STUB, startedAt);
      return;
    }

    // 自分の直前の発話より後、かつ前回の委譲より後の断片だけを質問文とみなす。
    const sinceMs = Math.max(this.lastOutputEndMs, this.lastDelegationOffsetMs);
    const text = reconstructQuestion({
      fragments: this.inputFragments,
      sinceMs,
      untilMs: offsetMs,
    });
    this.lastDelegationOffsetMs = Number.isFinite(offsetMs)
      ? offsetMs
      : this.lastDelegationOffsetMs;

    logger.info("[LiveBridge] delegation created", {
      id: delegationId,
      count: this.delegationCount,
      offsetMs,
      sinceMs,
      lastInputEndMs: this.inputFragments.at(-1)?.endMs ?? -1,
      question: text,
    });

    if (!text) {
      logger.warn("[LiveBridge] delegation question empty");
      this.sendCommentary(delegationId, DELEGATION_FALLBACK, startedAt);
      return;
    }

    this.currentTurn?.abort();
    const controller = new AbortController();
    this.currentTurn = controller;

    const progress = createDelegationProgress({
      signal: controller.signal,
      send: (content, step) =>
        this.sendProgress(delegationId, content, step, startedAt),
    });
    progress.start();

    this.conversationPromise ??= createVoiceConversation({
      env: this.env,
      from: this.from,
      callSid: this.callSid,
    });

    try {
      const conversation = await this.conversationPromise;
      let answer = "";
      for await (const delta of conversation.runTurn({
        text,
        signal: controller.signal,
      })) {
        answer += delta;
      }
      if (controller.signal.aborted) return;
      this.sendCommentary(
        delegationId,
        answer || DELEGATION_FALLBACK,
        startedAt,
      );
    } catch (e) {
      logger.error("[LiveBridge] delegation turn failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      if (!controller.signal.aborted) {
        this.sendCommentary(delegationId, DELEGATION_FALLBACK, startedAt);
      }
    } finally {
      progress.dispose();
      if (this.currentTurn === controller) this.currentTurn = null;
    }
  }

  private sendProgress(
    delegationId: string,
    content: string,
    step: { index: number; atMs: number },
    startedAt: number,
  ) {
    logger.info("[LiveBridge] progress sent", {
      id: delegationId,
      index: step.index,
      scheduledAtMs: step.atMs,
      elapsedMs: Date.now() - startedAt,
      content,
    });
    this.live?.send(
      serializeLiveMessage(commentaryAppendMessage(delegationId, content)),
    );
  }

  private sendCommentary(
    delegationId: string,
    answer: string,
    startedAt: number,
  ) {
    logger.info("[LiveBridge] commentary sent", {
      id: delegationId,
      contentChars: answer.length,
      delegationMs: Date.now() - startedAt,
    });
    this.live?.send(
      serializeLiveMessage(commentaryAppendMessage(delegationId, answer)),
    );
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
    this.currentTurn?.abort();
    this.live?.close(1000, "bridge shutdown");
    this.twilio?.close(1000, "bridge shutdown");
  }
}
