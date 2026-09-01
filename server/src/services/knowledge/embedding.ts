import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import matter from "gray-matter";
import { GEMINI_EMBEDDING } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { recordLlmUsage } from "~/services/analytics/llm-usage";

const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 100;
const MIN_CHUNK_LENGTH = 50;
const MAX_DELETE_ITERATIONS = 1000;

type EmbeddingModel = ReturnType<
  ReturnType<typeof createGoogleGenerativeAI>["textEmbeddingModel"]
>;

type ChunkMetadata = {
  source: string;
  title?: string;
  section?: string;
  subsection?: string;
  content: string;
  contentHash: string;
  [key: string]: string | number | boolean | string[] | undefined;
};

const hashText = async (text: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

type VectorData = {
  id: string;
  values: number[];
  metadata: ChunkMetadata;
};

let cachedEmbeddingModel: EmbeddingModel | null = null;
let cachedApiKey: string | null = null;

const getEmbeddingModel = (apiKey: string): EmbeddingModel => {
  if (cachedEmbeddingModel && cachedApiKey === apiKey) {
    return cachedEmbeddingModel;
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const model = google.textEmbeddingModel(GEMINI_EMBEDDING);
  cachedEmbeddingModel = model;
  cachedApiKey = apiKey;

  return model;
};

/**
 * Markdown コンテンツを chunk に分割
 * markdown戦略でheaders指定により、見出し構造を活用してチャンクを生成
 */
const chunkDocument = async (
  filename: string,
  content: string,
): Promise<{ texts: string[]; metadata: ChunkMetadata[] }> => {
  const { data: frontmatter, content: body } = matter(content);
  const doc = MDocument.fromMarkdown(body);

  await doc.chunk({
    strategy: "markdown",
    headers: [
      ["#", "title"],
      ["##", "section"],
      ["###", "subsection"],
    ],
  });

  // MDocument のメソッドを活用してテキストとメタデータを取得
  const allTexts = doc.getText();
  const chunkMetadataList = doc.getMetadata();

  // 短すぎるチャンクを除外（embedding 品質向上のため）
  const filteredIndices = allTexts
    .map((text, i) => ({ text, i }))
    .filter(({ text }) => text.length >= MIN_CHUNK_LENGTH)
    .map(({ i }) => i);

  const texts = filteredIndices.map((i) => {
    const chunkMeta = chunkMetadataList[i] as
      | Record<string, unknown>
      | undefined;
    const prefix = [chunkMeta?.title, chunkMeta?.section, chunkMeta?.subsection]
      .filter((v): v is string => typeof v === "string")
      .join(" > ");
    return prefix ? `${prefix}\n\n${allTexts[i]}` : allTexts[i];
  });
  const metadata: ChunkMetadata[] = await Promise.all(
    filteredIndices.map(async (i, idx) => {
      const chunkMeta = chunkMetadataList[i] as
        | Record<string, unknown>
        | undefined;
      return {
        ...frontmatter,
        source: filename,
        title: chunkMeta?.title as string | undefined,
        section: chunkMeta?.section as string | undefined,
        subsection: chunkMeta?.subsection as string | undefined,
        content: texts[idx],
        contentHash: await hashText(texts[idx]),
      };
    }),
  );

  logger.info(
    `[Knowledge Sync] ${filename}: ${allTexts.length} chunks -> ${texts.length} after filtering (min ${MIN_CHUNK_LENGTH} chars)`,
  );

  return { texts, metadata };
};

/**
 * テキスト配列から embeddings を生成
 */
const generateEmbeddings = async (texts: string[], apiKey: string) => {
  if (texts.length === 0) {
    return { embeddings: [], tokens: 0 };
  }

  const model = getEmbeddingModel(apiKey);
  const allEmbeddings: number[][] = [];
  let tokens = 0;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings, usage } = await embedMany({
      model,
      values: batch,
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
          taskType: "RETRIEVAL_DOCUMENT",
        },
      },
    });
    allEmbeddings.push(...embeddings);
    tokens += usage?.tokens ?? 0;
  }

  return { embeddings: allEmbeddings, tokens };
};

/**
 * 単一ファイルを処理して Vectorize に登録
 */
export const processKnowledgeFile = async (
  filename: string,
  content: string,
  vectorize: VectorizeIndex,
  apiKey: string,
  d1?: D1Database,
): Promise<{ chunks: number; error?: string }> => {
  try {
    // 1. Chunk 分割（MDocument のメソッドを活用）
    const { texts, metadata } = await chunkDocument(filename, content);

    if (texts.length === 0) {
      return { chunks: 0 };
    }

    // 2. Embeddings 生成
    const { embeddings, tokens } = await generateEmbeddings(texts, apiKey);
    if (d1) {
      await recordLlmUsage(d1, {
        model: GEMINI_EMBEDDING,
        usage: { inputTokens: tokens },
        source: "embedding",
        agent: "embedding",
      });
    }

    // 3. ベクトルデータの作成
    const vectors: VectorData[] = texts.map((_, i) => ({
      id: crypto.randomUUID(),
      values: embeddings[i],
      metadata: metadata[i],
    }));

    // 4. バッチで Vectorize に upsert
    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
      const batch = vectors.slice(i, i + BATCH_SIZE);
      await vectorize.upsert(
        batch.map((v) => ({
          id: v.id,
          values: v.values,
          metadata: Object.fromEntries(
            Object.entries(v.metadata).filter(([, val]) => val !== undefined),
          ) as Record<string, string | number | boolean | string[]>,
        })),
      );
    }

    return { chunks: texts.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { chunks: 0, error: message };
  }
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
  for (let i = 0; i < MAX_DELETE_ITERATIONS; i++) {
    const results = await vectorize.query(dummyVector, {
      topK: 50,
      returnMetadata: "all",
    });

    if (results.matches.length === 0) break;

    const ids = results.matches.map((m) => m.id);
    await vectorize.deleteByIds(ids);
    totalDeleted += ids.length;
  }

  if (totalDeleted >= MAX_DELETE_ITERATIONS * 50) {
    logger.warn(
      `[Knowledge] deleteAllKnowledge reached iteration limit (${MAX_DELETE_ITERATIONS}), some vectors may remain`,
    );
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

  for (let i = 0; i < MAX_DELETE_ITERATIONS; i++) {
    const results = await vectorize.query(dummyVector, {
      topK: 50,
      returnMetadata: "all",
      filter: { source: { $eq: source } },
    });

    if (results.matches.length === 0) break;

    const ids = results.matches.map((m) => m.id);
    await vectorize.deleteByIds(ids);
    totalDeleted += ids.length;
  }

  if (totalDeleted >= MAX_DELETE_ITERATIONS * 50) {
    logger.warn(
      `[Knowledge] deleteKnowledgeBySource(${source}) reached iteration limit (${MAX_DELETE_ITERATIONS}), some vectors may remain`,
    );
  }

  return { deleted: totalDeleted };
};
