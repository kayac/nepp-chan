import * as Sentry from "@sentry/cloudflare";
import { logger } from "~/lib/logger";
import {
  indexKnowledgeSource,
  removeKnowledgeSource,
} from "~/services/knowledge/indexing";

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

export type R2EventMessage = {
  account: string;
  bucket: string;
  eventTime: string;
  action: R2EventType;
  object: R2EventObject;
};

const isMarkdownFile = (key: string) => key.endsWith(".md");

const handleObjectCreate = async (
  key: string,
  eTag: string,
  env: CloudflareBindings,
): Promise<{
  success: boolean;
  chunks?: number;
  skipped?: string;
  error?: string;
}> => {
  const file = await env.KNOWLEDGE_BUCKET.get(key);
  if (!file) {
    return { success: false, error: `File not found: ${key}` };
  }

  const content = await file.text();

  const result = await indexKnowledgeSource(
    key,
    content,
    {
      d1: env.DB,
      vectorize: env.VECTORIZE,
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    },
    { r2Etag: eTag, skipUnchanged: true },
  );

  if (!result.indexed) {
    return { success: true, skipped: result.status };
  }

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
    const result = await removeKnowledgeSource(key, {
      d1: env.DB,
      vectorize: env.VECTORIZE,
    });
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

    logger.info(`Processing R2 event: ${action} for ${key}`);

    try {
      let success = true;

      switch (action) {
        case "PutObject":
        case "CompleteMultipartUpload":
        case "CopyObject": {
          const result = await handleObjectCreate(key, object.eTag, env);
          if (result.success && result.skipped) {
            logger.info(`Skipped ${key}: approval status is ${result.skipped}`);
          } else if (result.success) {
            logger.info(`Synced ${key}: ${result.chunks} chunks`);
          } else {
            logger.error(`Failed to sync ${key}`, result.error);
            success = false;
          }
          break;
        }
        case "DeleteObject":
        case "LifecycleDeletion": {
          const result = await handleObjectDelete(key, env);
          if (result.success) {
            logger.info(`Deleted vectors for ${key}: ${result.deleted} items`);
          } else {
            logger.error(`Failed to delete ${key}`, result.error);
            success = false;
          }
          break;
        }
        default:
          logger.info(`Ignoring action: ${action}`);
      }

      if (success) {
        message.ack();
      } else {
        message.retry();
      }
    } catch (error) {
      Sentry.captureException(error, { tags: { handler: "r2-event" } });
      logger.error(`Error processing ${key}`, error);
      message.retry();
    }
  }
};
