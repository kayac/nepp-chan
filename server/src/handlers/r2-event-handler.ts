import {
  deleteKnowledgeBySource,
  processKnowledgeFile,
} from "~/mastra/knowledge";

type R2EventType =
  | "object-create"
  | "object-delete"
  | "lifecycle-abort-multipart-upload"
  | "lifecycle-delete"
  | "lifecycle-expire";

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

    console.log(`Processing R2 event: ${action} for ${key}`);

    try {
      switch (action) {
        case "object-create": {
          const result = await handleObjectCreate(key, env);
          if (result.success) {
            console.log(`Synced ${key}: ${result.chunks} chunks`);
          } else {
            console.error(`Failed to sync ${key}: ${result.error}`);
          }
          break;
        }
        case "object-delete":
        case "lifecycle-delete":
        case "lifecycle-expire": {
          const result = await handleObjectDelete(key, env);
          if (result.success) {
            console.log(`Deleted vectors for ${key}: ${result.deleted} items`);
          } else {
            console.error(`Failed to delete ${key}: ${result.error}`);
          }
          break;
        }
        default:
          console.log(`Ignoring action: ${action}`);
      }
      message.ack();
    } catch (error) {
      console.error(`Error processing ${key}:`, error);
      message.retry();
    }
  }
};
