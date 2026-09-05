import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embedMany } from "ai";
import { GEMINI_EMBEDDING } from "~/lib/llm-models";
import { EMBEDDING_DIMENSIONS } from "./vector-store";

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

export const generateEmbeddings = async (texts: string[], apiKey: string) => {
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
