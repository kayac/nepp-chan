import { logger } from "~/lib/logger";
import {
  deleteKnowledgeBySource,
  processKnowledgeFile,
} from "~/services/knowledge/embedding";

type R2EventType =
  | "PutObject"
  | "CompleteMultipartUpload"
  | "CopyObject"
  | "DeleteObject"
  | "LifecycleDeletion";

type R2EventObject = {
  key: string;
  size: number;
  eTag: string;
};

type R2EventMessage = {
  account: string;
  bucket: string;
  eventTime: string;
  action: R2EventType;
  object: R2EventObject;
};

const isMarkdownFile = (key: string) => key.endsWith(".md");

const handleObjectCreate = async (
  key: string,
  env: CloudflareBindings,
): Promise<{ success: boolean; chunks?: number; error?: string }> => {
  const file = await env.KNOWLEDGE_BUCKET.get(key);
  if (!file) {
    return { success: false, error: `File not found: ${key}` };
  }

  const content = await file.text();

  // 既存データを削除してから再登録
  await deleteKnowledgeBySource(env.VECTORIZE, key);

  const result = await processKnowledgeFile(
    key,
    content,
    env.VECTORIZE,
    env.GOOGLE_GENERATIVE_AI_API_KEY,
  );

  if (result.error) {
    return { success: false, error: result.error };
  }

  return { success: true, chunks: result.chunks };
};

const handleObjectDelete = async (
  key: string,
  env: CloudflareBindings,
): Promise<{ success: boolean; deleted?: number; error?: string }> => {
  try {
    const result = await deleteKnowledgeBySource(env.VECTORIZE, key);
    return { success: true, deleted: result.deleted };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const handleR2Event = async (
  batch: MessageBatch<R2EventMessage>,
  env: CloudflareBindings,
) => {
  for (const message of batch.messages) {
    const { action, object } = message.body;
    const key = object.key;

    // Markdownファイル以外は無視
    if (!isMarkdownFile(key)) {
      message.ack();
      continue;
    }

    logger.info("Processing R2 event", { action, key });

    try {
      switch (action) {
        case "PutObject":
        case "CompleteMultipartUpload":
        case "CopyObject": {
          const result = await handleObjectCreate(key, env);
          if (result.success) {
            logger.info("Synced file", { key, chunks: result.chunks });
          } else {
            logger.error("Failed to sync file", { key, error: result.error });
          }
          break;
        }
        case "DeleteObject":
        case "LifecycleDeletion": {
          const result = await handleObjectDelete(key, env);
          if (result.success) {
            logger.info("Deleted vectors", { key, deleted: result.deleted });
          } else {
            logger.error("Failed to delete vectors", {
              key,
              error: result.error,
            });
          }
          break;
        }
        default:
          logger.info("Ignoring action", { action });
      }
      message.ack();
    } catch (error) {
      logger.error("Error processing R2 event", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      message.retry();
    }
  }
};
