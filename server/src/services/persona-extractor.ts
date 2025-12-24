import type { MastraStorage } from "@mastra/core/storage";
import { Memory } from "@mastra/memory";
import { getStorage } from "~/lib/storage";
import { createMastra } from "~/mastra/factory";
import { getWorkingMemoryByThread } from "~/mastra/memory";
import { createRequestContext } from "~/mastra/request-context";
import { threadPersonaStatusRepository } from "~/repository/thread-persona-status-repository";

type ExtractResult =
  | { skipped: true; reason: string; messageCount?: number }
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
  resourceId: string,
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

  const lastMessage = result.messages[result.messages.length - 1];
  const conversationEndedAt =
    lastMessage?.createdAt instanceof Date
      ? lastMessage.createdAt.toISOString()
      : typeof lastMessage?.createdAt === "string"
        ? lastMessage.createdAt
        : new Date().toISOString();

  // Working Memory を取得（参考情報として personaAgent に渡す）
  const workingMemory = await getWorkingMemoryByThread(
    env.DB,
    threadId,
    resourceId,
  );
  const workingMemoryText = workingMemory
    ? `## Working Memory（参考情報）\n${JSON.stringify(workingMemory, null, 2)}\n\n`
    : "";

  const storage = await getStorage(env.DB);
  const mastra = createMastra(storage as unknown as MastraStorage);
  const agent = mastra.getAgent("personaAgent");
  const requestContext = createRequestContext({
    storage,
    db: env.DB,
    env,
    conversationEndedAt,
  });

  try {
    await agent.generate(
      `以下の会話からペルソナ情報を抽出して保存してください。複数のトピックがあれば、それぞれ別のペルソナとして保存してください。\n\n${workingMemoryText}## 会話履歴\n${conversationText}`,
      { requestContext },
    );
  } catch (error) {
    // Gemini API が candidates を返さない場合は「保存すべきペルソナがない」と判断
    // これは正常な動作なので skipped として扱う
    const isNoPersonaFound =
      error instanceof Error && error.message === "Invalid JSON response";
    if (isNoPersonaFound) {
      return {
        skipped: true,
        reason: "no_persona_found",
        messageCount: totalMessages,
      };
    }
    // その他のエラーはログに出力してスキップ
    console.error(`Persona extraction failed for thread ${threadId}:`, error);
    return {
      skipped: true,
      reason: "extraction_error",
      messageCount: totalMessages,
    };
  }

  return { extracted: true, messageCount: totalMessages };
};

type ThreadInfo = { id: string; resourceId: string };

const getAllThreads = async (db: D1Database): Promise<ThreadInfo[]> => {
  const result = await db
    .prepare(
      "SELECT id, resourceId FROM mastra_threads ORDER BY createdAt DESC",
    )
    .all<ThreadInfo>();
  return result.results;
};

export const extractAllPendingThreads = async (env: CloudflareBindings) => {
  const allStatus = await threadPersonaStatusRepository.findAll(env.DB);
  const statusMap = new Map(allStatus.map((s) => [s.threadId, s]));

  const threads = await getAllThreads(env.DB);

  const results: Array<{
    threadId: string;
    result: ExtractResult;
  }> = [];

  for (const thread of threads) {
    const status = statusMap.get(thread.id);
    const lastMessageCount = status?.lastMessageCount ?? 0;

    const result = await extractPersonaFromThread(
      thread.id,
      thread.resourceId,
      lastMessageCount,
      env,
    );

    results.push({ threadId: thread.id, result });

    // extracted または skipped (messageCount あり) の場合はステータスを更新
    // これにより次回の再処理を防ぐ
    const messageCount =
      "messageCount" in result ? result.messageCount : undefined;
    if (messageCount !== undefined) {
      await threadPersonaStatusRepository.upsert(env.DB, {
        threadId: thread.id,
        lastExtractedAt: new Date().toISOString(),
        lastMessageCount: messageCount,
      });
    }
  }

  return results;
};
