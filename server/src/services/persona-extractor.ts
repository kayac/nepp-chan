import { Mastra } from "@mastra/core/mastra";
import { Memory } from "@mastra/memory";
import { count, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { createDb, mastraThreads, persona, threadPersonaStatus } from "~/db";
import { logger } from "~/lib/logger";
import { getStorage } from "~/lib/storage";
import { personaAgent } from "~/mastra/agents/persona-agent";
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
  const mastra = new Mastra({
    agents: { personaAgent },
    storage,
  });
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
    logger.error("Persona extraction failed", {
      threadId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      skipped: true,
      reason: "extraction_error",
      messageCount: totalMessages,
    };
  }

  return { extracted: true, messageCount: totalMessages };
};

type ThreadInfo = { id: string; resourceId: string };

const getAllThreads = async (d1: D1Database): Promise<ThreadInfo[]> => {
  const db = createDb(d1);

  const results = await db
    .select({
      id: mastraThreads.id,
      resourceId: mastraThreads.resourceId,
    })
    .from(mastraThreads)
    .orderBy(desc(mastraThreads.id))
    .all();

  return results.filter((t): t is ThreadInfo => t.resourceId !== null);
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

const findThreadById = async (
  d1: D1Database,
  threadId: string,
): Promise<ThreadInfo> => {
  const db = createDb(d1);

  const thread = await db
    .select({
      id: mastraThreads.id,
      resourceId: mastraThreads.resourceId,
    })
    .from(mastraThreads)
    .where(eq(mastraThreads.id, threadId))
    .get();

  if (!thread || !thread.resourceId) {
    throw new HTTPException(404, { message: "スレッドが見つかりません" });
  }

  return thread as ThreadInfo;
};

export const extractPersonaFromThreadById = async (
  threadId: string,
  env: CloudflareBindings,
): Promise<{ result: ExtractResult; message: string }> => {
  const thread = await findThreadById(env.DB, threadId);

  const status = await threadPersonaStatusRepository.findByThreadId(
    env.DB,
    threadId,
  );
  const lastMessageCount = status?.lastMessageCount ?? 0;

  const result = await extractPersonaFromThread(
    threadId,
    thread.resourceId,
    lastMessageCount,
    env,
  );

  if ("extracted" in result && result.extracted) {
    await threadPersonaStatusRepository.upsert(env.DB, {
      threadId,
      lastExtractedAt: new Date().toISOString(),
      lastMessageCount: result.messageCount,
    });
  }

  const message =
    "extracted" in result
      ? `スレッド ${threadId} からペルソナを抽出しました`
      : `スレッド ${threadId} はスキップされました: ${result.reason}`;

  return { result, message };
};

export const deleteAllPersonas = async (
  d1: D1Database,
): Promise<{ count: number }> => {
  const db = createDb(d1);

  const countResult = await db.select({ count: count() }).from(persona).get();
  const totalCount = countResult?.count ?? 0;

  await db.delete(persona);
  await db.delete(threadPersonaStatus);

  return { count: totalCount };
};
