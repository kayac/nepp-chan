import { DurableObject } from "cloudflare:workers";
import { logger } from "~/lib/logger";
import { pickAizuchi, shouldSendAizuchi } from "./aizuchi";
import {
  BRIDGE_CONFIG_DEFAULTS,
  type BridgeConfig,
  parseBridgeConfig,
} from "./bridge-config";
import { createVoiceConversation } from "./conversation";
import {
  createVoiceFindingsSlot,
  type VoiceFindingsSlot,
} from "./findings-slot";
import {
  endMessage,
  parseRelayMessage,
  playMessage,
  serializeRelayMessage,
  type TextTokenOptions,
  textTokenMessage,
} from "./relay-protocol";
import { createSilenceCover } from "./silence-cover";
import { verifySetupToken } from "./twilio-token";

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
  private callSid = "";
  private verified = false;
  private socket: WebSocket | null = null;
  private currentTurn: AbortController | null = null;
  private fillerIndex = 0;
  private lastAizuchiAt: number | null = null;
  private aizuchiIndex = 0;
  // 直前の中間認識からの経過時間の観測用（endpointing がどれだけ確定を保留するか）。
  private lastInterimAt: number | null = null;
  private findingsSlot: VoiceFindingsSlot = createVoiceFindingsSlot();
  private config: BridgeConfig = BRIDGE_CONFIG_DEFAULTS;
  private pendingEndTimer: ReturnType<typeof setTimeout> | null = null;
  private conversationPromise: ReturnType<
    typeof createVoiceConversation
  > | null = null;
  private turnIndex = 0;

  async fetch() {
    const { 0: client, 1: server } = new WebSocketPair();
    this.socket = server;
    server.accept();
    server.addEventListener("message", (event) => {
      this.handleMessageEvent(server, event);
    });
    server.addEventListener("close", () => {
      this.currentTurn?.abort();
      this.cancelPendingEnd();
    });
    await this.ctx.storage.setAlarm(Date.now() + SETUP_TIMEOUT_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  private handleMessageEvent(ws: WebSocket, event: MessageEvent) {
    const task = this.onMessage(ws, event).catch((e) =>
      logger.error("[CallBridge] onMessage failed", {
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    this.ctx.waitUntil(task);
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
      this.callSid = msg.callSid;
      this.config = parseBridgeConfig(msg.customParameters);
    } else if (msg.type === "prompt") {
      if (!this.verified) return;
      // 切断待ちの間にユーザーが話し始めたら会話継続の意思とみなし切断を取り消す。
      this.cancelPendingEnd();
      if (msg.last === false) {
        this.lastInterimAt = Date.now();
        this.maybeSendAizuchi(ws);
        return;
      }
      logger.info("[Voice] final prompt", {
        voicePrompt: msg.voicePrompt,
        sinceLastInterimMs: this.lastInterimAt
          ? Date.now() - this.lastInterimAt
          : -1,
      });
      this.lastInterimAt = null;
      await this.handlePrompt(ws, msg.voicePrompt);
    } else if (msg.type === "interrupt") {
      logger.info("[Voice] interrupt", {
        utteranceUntilInterrupt: msg.utteranceUntilInterrupt ?? "",
        durationUntilInterruptMs: msg.durationUntilInterruptMs ?? -1,
      });
      this.cancelPendingEnd();
      this.currentTurn?.abort();
    } else if (msg.type === "error") {
      logger.warn("[CallBridge] relay error", {
        description: msg.description ?? "",
      });
    }
  }

  // 中間認識を受けるたびに、クールダウン明けなら即座に相槌を挟む。
  // 区切りを待たず、話している最中も相槌を続けて構わないという前提に立った実装。
  private maybeSendAizuchi(ws: WebSocket) {
    if (!this.config.aizuchiEnabled) return;
    const now = Date.now();
    if (
      !shouldSendAizuchi({
        hasActiveTurn: this.currentTurn !== null,
        lastAizuchiAt: this.lastAizuchiAt,
        now,
        cooldownMs: this.config.aizuchiCooldownMs,
      })
    ) {
      return;
    }
    this.lastAizuchiAt = now;
    const phrase = pickAizuchi(this.aizuchiIndex++, this.config.aizuchiPhrases);
    logger.info("[Voice] aizuchi sent", { phrase });
    ws.send(
      serializeRelayMessage(
        textTokenMessage(phrase, true, {
          preemptible: true,
          // ユーザーは話し続けている最中なので interruptible:true だと即座に
          // interrupt が飛んできて相槌がほぼ聞こえない。ここは中断させない。
          interruptible: false,
        }),
      ),
    );
  }

  private async handlePrompt(ws: WebSocket, text: string) {
    this.currentTurn?.abort();
    const controller = new AbortController();
    this.currentTurn = controller;

    const t0 = Date.now();
    this.conversationPromise ??= createVoiceConversation({
      env: this.env,
      from: this.from,
      callSid: this.callSid,
    });
    const conversation = await this.conversationPromise;
    if (controller.signal.aborted || this.currentTurn !== controller) {
      if (this.currentTurn === controller) this.currentTurn = null;
      return;
    }

    let firstSendMs: number | null = null;
    let tokenCount = 0;
    let assistantChars = 0;
    let assistantText = "";
    let endRequested = false;
    let responseEndMs: number | null = null;
    let persistenceMs: number | null = null;

    const send = (token: string, last = false, options?: TextTokenOptions) =>
      ws.send(serializeRelayMessage(textTokenMessage(token, last, options)));

    const cover = createSilenceCover({
      config: this.config,
      promptText: text,
      signal: controller.signal,
      nextFillerIndex: () => this.fillerIndex++,
      sendText: send,
      sendPlay: (source, options) =>
        ws.send(serializeRelayMessage(playMessage(source, options))),
    });
    cover.start();

    try {
      for await (const delta of conversation.runTurn({
        text,
        turnIndex: this.turnIndex + 1,
        signal: controller.signal,
        onToolCall: cover.onToolCall,
        onEndCall: () => {
          endRequested = true;
        },
        findingsSlot: this.findingsSlot,
        prefetchEnabled: this.config.prefetchEnabled,
        parentRouting: this.config.parentRoutingEnabled,
      })) {
        if (controller.signal.aborted) break;
        if (firstSendMs === null) firstSendMs = Date.now() - t0;
        tokenCount++;
        assistantChars += delta.length;
        assistantText += delta;
        cover.onToken();
        send(delta);
      }
      if (!controller.signal.aborted) {
        send("", true);
        responseEndMs = Date.now() - t0;
        if (this.currentTurn === controller) this.currentTurn = null;
        if (endRequested && this.config.endCallEnabled) {
          this.scheduleEndCall(ws, assistantChars);
        }
        if (assistantText) {
          const turnIndex = this.turnIndex++;
          const persistStart = Date.now();
          try {
            await conversation.persistTurn({
              turnIndex,
              userText: text,
              assistantText,
            });
          } catch (e) {
            logger.error("[Voice] turn persistence failed", {
              error: e instanceof Error ? e.message : String(e),
              turnIndex,
            });
          }
          persistenceMs = Date.now() - persistStart;
        }
      }
    } catch (e) {
      logger.error("[CallBridge] handlePrompt failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      if (!controller.signal.aborted) {
        send("ごめんね、うまく聞き取れなかったみたい。", true);
      }
    } finally {
      cover.dispose();
      if (this.currentTurn === controller) this.currentTurn = null;
      const timing: Record<string, number | boolean> = {
        turnEndMs: responseEndMs ?? Date.now() - t0,
        tokenCount,
        aborted: controller.signal.aborted,
      };
      if (firstSendMs !== null) timing.firstSendMs = firstSendMs;
      if (persistenceMs !== null) timing.persistenceMs = persistenceMs;
      logger.info("[Voice] turn timing", timing);
    }
  }

  // Twilio の end がキュー済み TTS の再生完了を待つかは未文書のため、
  // お別れの発話を読み終わる想定時間（約150ms/文字 + 余白1秒）だけ待ってから切る。
  private scheduleEndCall(ws: WebSocket, assistantChars: number) {
    this.cancelPendingEnd();
    const waitMs = Math.min(1_000 + assistantChars * 150, 15_000);
    logger.info("[Voice] end call scheduled", { waitMs });
    this.pendingEndTimer = setTimeout(() => {
      this.pendingEndTimer = null;
      logger.info("[Voice] ending call");
      ws.send(serializeRelayMessage(endMessage()));
    }, waitMs);
  }

  private cancelPendingEnd() {
    if (!this.pendingEndTimer) return;
    clearTimeout(this.pendingEndTimer);
    this.pendingEndTimer = null;
    logger.info("[Voice] end call cancelled");
  }
}
