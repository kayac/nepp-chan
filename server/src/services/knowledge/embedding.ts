import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embedMany } from "ai";
import { GEMINI_EMBEDDING } from "~/lib/llm-models";
import { recordLlmUsage } from "~/services/analytics/llm-usage";
import { chunkDocument } from "./chunk";
import { EMBEDDING_DIMENSIONS, upsertVectors } from "./vector-store";

const EMBED_BATCH_SIZE = 100;

type EmbeddingModel = ReturnType<
  ReturnType<typeof createGoogleGenerativeAI>["textEmbeddingModel"]
>;

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

const generateEmbeddings = async (texts: string[], apiKey: string) => {
  if (texts.length === 0) {
    return { embeddings: [], tokens: 0 };
  }

  const model = getEmbeddingModel(apiKey);
  const allEmbeddings: number[][] = [];
  let tokens = 0;

  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
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

export const processKnowledgeFile = async (
  filename: string,
  content: string,
  vectorize: VectorizeIndex,
  apiKey: string,
  d1?: D1Database,
): Promise<{ chunks: number; error?: string }> => {
  try {
    const { texts, metadata } = await chunkDocument(filename, content);

    if (texts.length === 0) {
      return { chunks: 0 };
    }

    const { embeddings, tokens } = await generateEmbeddings(texts, apiKey);
    if (d1) {
      await recordLlmUsage(d1, {
        model: GEMINI_EMBEDDING,
        usage: { inputTokens: tokens },
        source: "embedding",
        agent: "embedding",
      });
    }

    await upsertVectors(
      vectorize,
      texts.map((_, i) => ({
        id: crypto.randomUUID(),
        values: embeddings[i],
        metadata: metadata[i],
      })),
    );

    return { chunks: texts.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { chunks: 0, error: message };
  }
};
