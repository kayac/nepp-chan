import type { MastraStorage } from "@mastra/core/storage";
import { Memory } from "@mastra/memory";
import { getStorage } from "~/lib/storage";
import { createMastra } from "~/mastra/factory";
import { createRequestContext } from "~/mastra/request-context";
import { threadPersonaStatusRepository } from "~/repository/thread-persona-status-repository";

const RESOURCE_ID = "otoineppu";

type ExtractResult =
  | { skipped: true; reason: string }
  | { extracted: true; messageCount: number };

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

  await agent.generate(
    `以下の会話からペルソナ情報を抽出して保存してください。複数のトピックがあれば、それぞれ別のペルソナとして保存してください:\n\n${conversationText}`,
    { requestContext },
  );

  return { extracted: true, messageCount: totalMessages };
};

export const extractAllPendingThreads = async (env: CloudflareBindings) => {
  const memory = await getMemory(env.DB);

  const allStatus = await threadPersonaStatusRepository.findAll(env.DB);
  const statusMap = new Map(allStatus.map((s) => [s.threadId, s]));

  let page = 0;
  const perPage = 100;
  let hasMore = true;
  const results: Array<{
    threadId: string;
    result: ExtractResult;
  }> = [];

  while (hasMore) {
    const threadsResult = await memory.listThreadsByResourceId({
      resourceId: RESOURCE_ID,
      page,
      perPage,
    });

    for (const thread of threadsResult.threads) {
      const status = statusMap.get(thread.id);
      const lastMessageCount = status?.lastMessageCount ?? 0;

      const result = await extractPersonaFromThread(
        thread.id,
        lastMessageCount,
        env,
      );

      results.push({ threadId: thread.id, result });

      if ("extracted" in result && result.extracted) {
        await threadPersonaStatusRepository.upsert(env.DB, {
          threadId: thread.id,
          lastExtractedAt: new Date().toISOString(),
          lastMessageCount: result.messageCount,
        });
      }
    }

    hasMore = threadsResult.hasMore;
    page++;
  }

  return results;
};
