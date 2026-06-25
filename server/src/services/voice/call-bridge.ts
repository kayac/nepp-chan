import { DurableObject } from "cloudflare:workers";
import { logger } from "~/lib/logger";
import { runVoiceTurn } from "./conversation";
import {
  parseRelayMessage,
  serializeRelayMessage,
  textTokenMessage,
} from "./relay-protocol";
import { verifyRelayToken } from "./twilio-token";

// relay WS（ConversationRelay → サーバー）の Upgrade を受け、短命トークンを検証して
// 新しい CallBridge インスタンスへ委譲する。1 接続 = 1 DO インスタンス。
export const handleRelayUpgrade = async (
  request: Request,
  env: CloudflareBindings,
): Promise<Response> => {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response("missing token", { status: 401 });

  const claims = await verifyRelayToken(token, env.CALL_TOKEN_SECRET, {
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!claims) return new Response("invalid token", { status: 401 });

  const id = env.CALL_BRIDGE.newUniqueId();
  return env.CALL_BRIDGE.get(id).fetch(request);
};

// WS 配線のみ。応答生成は runVoiceTurn、メッセージ型は relay-protocol 側。
export class CallBridge extends DurableObject<CloudflareBindings> {
  private from = "";
  private currentTurn: AbortController | null = null;

  async fetch(): Promise<Response> {
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

  private async onMessage(ws: WebSocket, event: MessageEvent): Promise<void> {
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
      await this.handlePrompt(ws, msg.voicePrompt);
    } else if (msg.type === "interrupt") {
      this.currentTurn?.abort();
    } else if (msg.type === "error") {
      logger.warn("[CallBridge] relay error", {
        description: msg.description ?? "",
      });
    }
  }

  private async handlePrompt(ws: WebSocket, text: string): Promise<void> {
    this.currentTurn?.abort();
    const controller = new AbortController();
    this.currentTurn = controller;

    const send = (token: string, last = false) =>
      ws.send(serializeRelayMessage(textTokenMessage(token, last)));

    try {
      for await (const delta of runVoiceTurn({
        env: this.env,
        from: this.from,
        text,
        signal: controller.signal,
      })) {
        if (controller.signal.aborted) break;
        send(delta);
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
    }
  }
}
