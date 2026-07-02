import { DurableObject } from "cloudflare:workers";
import { logger } from "~/lib/logger";
import { runVoiceTurn } from "./conversation";
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
import { verifyRelayToken } from "./twilio-token";

const HOLD_AUDIO_URL = "https://demo.twilio.com/docs/classic.mp3";

export const handleRelayUpgrade = async (
  request: Request,
  env: CloudflareBindings,
) => {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response("missing token", { status: 401 });

  const claims = await verifyRelayToken(token, env.CALL_TOKEN_SECRET, {
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!claims) return new Response("invalid token", { status: 401 });

  const id = env.CALL_BRIDGE.newUniqueId();
  return env.CALL_BRIDGE.get(id).fetch(request);
};

export class CallBridge extends DurableObject<CloudflareBindings> {
  private from = "";
  private currentTurn: AbortController | null = null;
  private fillerIndex = 0;
  private findingsSlot: VoiceFindingsSlot = createVoiceFindingsSlot();

  async fetch() {
    const { 0: client, 1: server } = new WebSocketPair();
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
    return new Response(null, { status: 101, webSocket: client });
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
      this.from = msg.from;
    } else if (msg.type === "prompt") {
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
      for await (const delta of runVoiceTurn({
        env: this.env,
        from: this.from,
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
