import * as Sentry from "@sentry/cloudflare";
import { logger } from "~/lib/logger";
import { syncFile } from "~/services/knowledge/sync";
import { deleteKnowledgeBySource } from "~/services/knowledge/vector-store";

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

const RETRY_BASE_DELAY_SECONDS = 30;
const RETRY_MAX_DELAY_SECONDS = 300;

export const retryDelaySeconds = (attempts: number) =>
  Math.min(
    RETRY_MAX_DELAY_SECONDS,
    RETRY_BASE_DELAY_SECONDS * 2 ** (attempts - 1),
  );

const retryWithBackoff = (message: Message<R2EventMessage>) =>
  message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });

const handleObjectCreate = async (
  key: string,
  env: CloudflareBindings,
): Promise<{ success: boolean; chunks?: number; error?: string }> => {
  const file = await env.KNOWLEDGE_BUCKET.get(key);
  if (!file) {
    return { success: false, error: `File not found: ${key}` };
  }

  const result = await syncFile(key, await file.text(), {
    vectorize: env.VECTORIZE,
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    d1: env.DB,
  });

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
          const result = await handleObjectCreate(key, env);
          if (result.success) {
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
        retryWithBackoff(message);
      }
    } catch (error) {
      Sentry.captureException(error, { tags: { handler: "r2-event" } });
      logger.error(`Error processing ${key}`, error);
      retryWithBackoff(message);
    }
  }
};
