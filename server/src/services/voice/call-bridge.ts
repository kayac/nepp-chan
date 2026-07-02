import { DurableObject } from "cloudflare:workers";
import { logger } from "~/lib/logger";
import { createVoiceTurnRunner } from "./conversation";
import { pickFiller } from "./filler";
import {
  createVoiceFindingsSlot,
  type VoiceFindingsSlot,
} from "./findings-slot";
import {
  parseRelayMessage,
  playMessage,
  serializeRelayMessage,
  type TextTokenOptions,
  textTokenMessage,
} from "./relay-protocol";
import { verifySetupToken } from "./twilio-token";

const HOLD_AUDIO_URL = "https://demo.twilio.com/docs/classic.mp3";
// 有効な setup が届かない接続を無期限に張らせないための待受上限。
const SETUP_TIMEOUT_MS = 10_000;

// token は setup メッセージの customParameters で届くため、検証は onMessage 側で行う。
export const handleRelayUpgrade = (
  request: Request,
  env: CloudflareBindings,
) => {
  const id = env.CALL_BRIDGE.newUniqueId();
  return env.CALL_BRIDGE.get(id).fetch(request);
};

export class CallBridge extends DurableObject<CloudflareBindings> {
  private from = "";
  private verified = false;
  private socket: WebSocket | null = null;
  private currentTurn: AbortController | null = null;
  private fillerIndex = 0;
  private findingsSlot: VoiceFindingsSlot = createVoiceFindingsSlot();
  private turnRunnerPromise: ReturnType<typeof createVoiceTurnRunner> | null =
    null;

  async fetch() {
    const { 0: client, 1: server } = new WebSocketPair();
    this.socket = server;
    server.accept();
    server.addEventListener("message", (event) => {
      this.onMessage(server, event).catch((e) =>
        logger.error("[CallBridge] onMessage failed", {
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    });
    server.addEventListener("close", () => {
      this.currentTurn?.abort();
    });
    await this.ctx.storage.setAlarm(Date.now() + SETUP_TIMEOUT_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  async alarm() {
    if (!this.verified) {
      logger.warn("[CallBridge] no valid setup within timeout, closing");
      this.socket?.close(1008, "setup timeout");
    }
  }

  private async onMessage(ws: WebSocket, event: MessageEvent) {
    if (typeof event.data !== "string") return;
    const msg = parseRelayMessage(event.data);
    if (!msg) {
      logger.warn("[CallBridge] unparseable message", {
        raw: event.data.slice(0, 200),
      });
      return;
    }

    logger.info("[CallBridge] message", { type: msg.type });

    if (msg.type === "setup") {
      const claims = await verifySetupToken(
        msg.customParameters,
        this.env.CALL_TOKEN_SECRET,
      );
      if (!claims) {
        logger.warn("[CallBridge] invalid relay token on setup, closing");
        ws.close(1008, "invalid token");
        return;
      }
      this.verified = true;
      this.from = msg.from;
    } else if (msg.type === "prompt") {
      if (!this.verified) return;
      logger.info("[Voice] final prompt", { voicePrompt: msg.voicePrompt });
      await this.handlePrompt(ws, msg.voicePrompt);
    } else if (msg.type === "interrupt") {
      this.currentTurn?.abort();
    } else if (msg.type === "error") {
      logger.warn("[CallBridge] relay error", {
        description: msg.description ?? "",
      });
    }
  }

  private async handlePrompt(ws: WebSocket, text: string) {
    this.currentTurn?.abort();
    const controller = new AbortController();
    this.currentTurn = controller;

    const t0 = Date.now();
    this.turnRunnerPromise ??= createVoiceTurnRunner({
      env: this.env,
      from: this.from,
    });
    const turnRunner = await this.turnRunnerPromise;

    let firstSendMs: number | null = null;
    let tokenCount = 0;

    const send = (token: string, last = false, options?: TextTokenOptions) =>
      ws.send(serializeRelayMessage(textTokenMessage(token, last, options)));

    send(pickFiller(text, this.fillerIndex++), true, {
      preemptible: true,
      interruptible: true,
    });

    let holdPlaying = false;
    const startHold = () => {
      if (holdPlaying) return;
      holdPlaying = true;
      // 開いたテキストターン中は play が無視されるため、last:true で閉じてから保留音を流す。
      send("", true);
      ws.send(
        serializeRelayMessage(
          playMessage(HOLD_AUDIO_URL, {
            loop: 0,
            preemptible: true,
            interruptible: true,
          }),
        ),
      );
    };

    try {
      for await (const delta of turnRunner({
        text,
        signal: controller.signal,
        onToolCall: startHold,
        findingsSlot: this.findingsSlot,
      })) {
        if (controller.signal.aborted) break;
        if (firstSendMs === null) firstSendMs = Date.now() - t0;
        tokenCount++;
        send(delta);
        holdPlaying = false;
      }
      if (!controller.signal.aborted) send("", true);
    } catch (e) {
      logger.error("[CallBridge] handlePrompt failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      if (!controller.signal.aborted) {
        send("ごめんね、うまく聞き取れなかったみたい。", true);
      }
    } finally {
      if (this.currentTurn === controller) this.currentTurn = null;
      const timing: Record<string, number | boolean> = {
        turnEndMs: Date.now() - t0,
        tokenCount,
        aborted: controller.signal.aborted,
      };
      if (firstSendMs !== null) timing.firstSendMs = firstSendMs;
      logger.info("[Voice] turn timing", timing);
    }
  }
}
