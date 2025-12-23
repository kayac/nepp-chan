import type { MastraStorage } from "@mastra/core/storage";
import { Memory } from "@mastra/memory";
import { getStorage } from "~/lib/storage";
import { createMastra } from "~/mastra/factory";
import { createRequestContext } from "~/mastra/request-context";
import { threadPersonaStatusRepository } from "~/repository/thread-persona-status-repository";

type ExtractResult =
  | { skipped: true; reason: string }
  | { extracted: true; messageCount: number }
  | { error: true; reason: string };

const getMemory = async (db: D1Database) => {
  const storage = await getStorage(db);
  return new Memory({ storage });
};

const formatMessagesForAnalysis = (
  messages: Array<{ role: string; content: unknown }>,
) => {
  return messages
    .map((msg) => {
      const role = msg.role === "user" ? "ユーザー" : "ねっぷちゃん";
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      return `${role}: ${content}`;
    })
    .join("\n");
};

export const extractPersonaFromThread = async (
  threadId: string,
  lastMessageCount: number,
  env: CloudflareBindings,
): Promise<ExtractResult> => {
  const memory = await getMemory(env.DB);

  const result = await memory.recall({
    threadId,
    threadConfig: { lastMessages: false },
  });

  const totalMessages = result.messages.length;
  if (totalMessages <= lastMessageCount) {
    return { skipped: true, reason: "no_new_messages" };
  }

  const newMessages = result.messages.slice(lastMessageCount);
  const conversationText = formatMessagesForAnalysis(
    newMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  );

  if (!conversationText.trim()) {
    return { skipped: true, reason: "empty_conversation" };
  }

  const storage = await getStorage(env.DB);
  const mastra = createMastra(storage as unknown as MastraStorage);
  const agent = mastra.getAgent("personaAgent");
  const requestContext = createRequestContext({
    storage,
    db: env.DB,
    env,
  });

  try {
    await agent.generate(
      `以下の会話からペルソナ情報を抽出して保存してください。複数のトピックがあれば、それぞれ別のペルソナとして保存してください:\n\n${conversationText}`,
      { requestContext },
    );
  } catch (error) {
    console.error(`Persona extraction failed for thread ${threadId}:`, error);
    const message =
      error instanceof Error ? error.message : "Unknown extraction error";
    return { error: true, reason: message };
  }

  return { extracted: true, messageCount: totalMessages };
};

const getAllThreadIds = async (db: D1Database): Promise<string[]> => {
  const result = await db
    .prepare("SELECT id FROM mastra_threads ORDER BY createdAt DESC")
    .all<{ id: string }>();
  return result.results.map((row) => row.id);
};

export const extractAllPendingThreads = async (env: CloudflareBindings) => {
  const allStatus = await threadPersonaStatusRepository.findAll(env.DB);
  const statusMap = new Map(allStatus.map((s) => [s.threadId, s]));

  const threadIds = await getAllThreadIds(env.DB);

  const results: Array<{
    threadId: string;
    result: ExtractResult;
  }> = [];

  for (const threadId of threadIds) {
    const status = statusMap.get(threadId);
    const lastMessageCount = status?.lastMessageCount ?? 0;

    const result = await extractPersonaFromThread(
      threadId,
      lastMessageCount,
      env,
    );

    results.push({ threadId, result });

    if ("extracted" in result && result.extracted) {
      await threadPersonaStatusRepository.upsert(env.DB, {
        threadId,
        lastExtractedAt: new Date().toISOString(),
        lastMessageCount: result.messageCount,
      });
    }
  }

  return results;
};
