import type { D1Store } from "@mastra/cloudflare-d1";
import { logger } from "~/lib/logger";

const RECENT_MESSAGES = 30;

export const latestAssistantText = async (
  storage: D1Store,
  threadId: string,
) => {
  try {
    const memoryStore = await storage.getStore("memory");
    if (!memoryStore) return undefined;
    const { messages } = await memoryStore.listMessages({
      threadId,
      perPage: RECENT_MESSAGES,
      orderBy: { field: "createdAt", direction: "DESC" },
    });
    const assistant = messages.find((m) => m.role === "assistant");
    if (!assistant) return undefined;
    const text = assistant.content.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("");
    return text || undefined;
  } catch (error) {
    logger.warn("[ThreadHistory] failed to load latest assistant text", {
      threadId,
      error: String(error),
    });
    return undefined;
  }
};
