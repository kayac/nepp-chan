import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { MDocument } from "@mastra/rag";
import { embedMany } from "ai";

const EMBEDDING_MODEL_NAME = "text-embedding-004";
const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 100;

type EmbeddingModel = ReturnType<
  ReturnType<typeof createGoogleGenerativeAI>["textEmbeddingModel"]
>;

type ChunkMetadata = {
  source: string;
  section?: string;
  subsection?: string;
  content: string;
};

type VectorData = {
  id: string;
  values: number[];
  metadata: ChunkMetadata;
};

type SyncResult = {
  success: boolean;
  processedFiles: number;
  totalChunks: number;
  errors: string[];
};

const embeddingModelCache = new Map<string, EmbeddingModel>();

const getEmbeddingModel = (apiKey: string): EmbeddingModel => {
  const cachedModel = embeddingModelCache.get(apiKey);
  if (cachedModel) {
    return cachedModel;
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const model = google.textEmbeddingModel(EMBEDDING_MODEL_NAME);
  embeddingModelCache.set(apiKey, model);

  return model;
};

/**
 * Markdown コンテンツを chunk に分割
 */
const chunkDocument = async (
  filename: string,
  content: string,
): Promise<{ text: string; metadata: ChunkMetadata }[]> => {
  const doc = MDocument.fromMarkdown(content);

  const chunks = await doc.chunk({
    strategy: "recursive",
    maxSize: 1000,
    overlap: 100,
  });

  return chunks.map((chunk) => ({
    text: chunk.text,
    metadata: {
      source: filename,
      content: chunk.text,
    },
  }));
};

/**
 * テキスト配列から embeddings を生成
 */
const generateEmbeddings = async (
  texts: string[],
  apiKey: string,
): Promise<number[][]> => {
  if (texts.length === 0) {
    return [];
  }

  const model = getEmbeddingModel(apiKey);

  const { embeddings } = await embedMany({
    model,
    values: texts,
  });

  return embeddings;
};

/**
 * 単一ファイルを処理して Vectorize に登録
 */
export const processKnowledgeFile = async (
  filename: string,
  content: string,
  vectorize: VectorizeIndex,
  apiKey: string,
): Promise<{ chunks: number; error?: string }> => {
  try {
    // 1. Chunk 分割
    const chunks = await chunkDocument(filename, content);

    if (chunks.length === 0) {
      return { chunks: 0 };
    }

    // 2. Embeddings 生成
    const texts = chunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(texts, apiKey);

    // 3. ベクトルデータの作成
    const vectors: VectorData[] = chunks.map((chunk, i) => ({
      id: `${filename}-${i}`,
      values: embeddings[i],
      metadata: chunk.metadata,
    }));

    // 4. バッチで Vectorize に upsert
    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
      const batch = vectors.slice(i, i + BATCH_SIZE);
      await vectorize.upsert(
        batch.map((v) => ({
          id: v.id,
          values: v.values,
          metadata: v.metadata,
        })),
      );
    }

    return { chunks: chunks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { chunks: 0, error: message };
  }
};

/**
 * R2 バケットから全ファイルを同期
 */
export const syncAllKnowledge = async (
  bucket: R2Bucket,
  vectorize: VectorizeIndex,
  apiKey: string,
): Promise<SyncResult> => {
  const result: SyncResult = {
    success: true,
    processedFiles: 0,
    totalChunks: 0,
    errors: [],
  };

  try {
    const listed = await bucket.list();
    const mdFiles = listed.objects.filter((obj) => obj.key.endsWith(".md"));

    for (const obj of mdFiles) {
      const file = await bucket.get(obj.key);
      if (!file) {
        result.errors.push(`Failed to read: ${obj.key}`);
        continue;
      }

      const content = await file.text();
      const filename = obj.key;

      // 既存データを削除（同じソースのデータを更新するため）
      await deleteKnowledgeBySource(vectorize, filename);

      // ファイルを処理
      const processResult = await processKnowledgeFile(
        filename,
        content,
        vectorize,
        apiKey,
      );

      if (processResult.error) {
        result.errors.push(`${filename}: ${processResult.error}`);
      } else {
        result.processedFiles++;
        result.totalChunks += processResult.chunks;
      }
    }

    if (result.errors.length > 0) {
      result.success = false;
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  return result;
};

/**
 * 特定のファイルのみ同期
 */
export const syncKnowledgeBySource = async (
  bucket: R2Bucket,
  vectorize: VectorizeIndex,
  source: string,
  apiKey: string,
): Promise<SyncResult> => {
  const result: SyncResult = {
    success: true,
    processedFiles: 0,
    totalChunks: 0,
    errors: [],
  };

  try {
    const file = await bucket.get(source);
    if (!file) {
      result.success = false;
      result.errors.push(`File not found: ${source}`);
      return result;
    }

    const content = await file.text();

    // 既存データを削除
    await deleteKnowledgeBySource(vectorize, source);

    // ファイルを処理
    const processResult = await processKnowledgeFile(
      source,
      content,
      vectorize,
      apiKey,
    );

    if (processResult.error) {
      result.success = false;
      result.errors.push(`${source}: ${processResult.error}`);
    } else {
      result.processedFiles = 1;
      result.totalChunks = processResult.chunks;
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  return result;
};

/**
 * 全ナレッジを削除（バッチ処理）
 */
export const deleteAllKnowledge = async (
  vectorize: VectorizeIndex,
): Promise<{ deleted: number }> => {
  const dummyVector = new Array(EMBEDDING_DIMENSIONS).fill(0);
  let totalDeleted = 0;

  // returnMetadata: "all" の場合、topK は最大 50
  // 繰り返し削除してすべてのベクトルを削除
  let hasMore = true;
  while (hasMore) {
    const results = await vectorize.query(dummyVector, {
      topK: 50,
      returnMetadata: "all",
    });

    if (results.matches.length > 0) {
      const ids = results.matches.map((m) => m.id);
      await vectorize.deleteByIds(ids);
      totalDeleted += ids.length;
    } else {
      hasMore = false;
    }
  }

  return { deleted: totalDeleted };
};

/**
 * 特定ソースのナレッジを削除（バッチ処理）
 */
export const deleteKnowledgeBySource = async (
  vectorize: VectorizeIndex,
  source: string,
): Promise<{ deleted: number }> => {
  const dummyVector = new Array(EMBEDDING_DIMENSIONS).fill(0);
  let totalDeleted = 0;

  // returnMetadata: "all" の場合、topK は最大 50
  // 繰り返し削除してすべてのベクトルを削除
  let hasMore = true;
  while (hasMore) {
    const results = await vectorize.query(dummyVector, {
      topK: 50,
      returnMetadata: "all",
      filter: { source: { $eq: source } },
    });

    if (results.matches.length > 0) {
      const ids = results.matches.map((m) => m.id);
      await vectorize.deleteByIds(ids);
      totalDeleted += ids.length;
    } else {
      hasMore = false;
    }
  }

  return { deleted: totalDeleted };
};
