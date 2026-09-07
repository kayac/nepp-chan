import type { ChunkMetadata } from "./chunk";

export const EMBEDDING_DIMENSIONS = 1536;
const UPSERT_BATCH_SIZE = 100;
const DELETE_BATCH_SIZE = 1000;

type VectorData = {
  id: string;
  values: number[];
  metadata: ChunkMetadata;
};

const toVectorizeMetadata = (metadata: ChunkMetadata) =>
  Object.fromEntries(
    Object.entries(metadata).filter(([, val]) => val !== undefined),
  ) as Record<string, string | number | boolean | string[]>;

export const upsertVectors = async (
  vectorize: VectorizeIndex,
  vectors: VectorData[],
) => {
  for (let i = 0; i < vectors.length; i += UPSERT_BATCH_SIZE) {
    const batch = vectors.slice(i, i + UPSERT_BATCH_SIZE);
    await vectorize.upsert(
      batch.map((v) => ({
        id: v.id,
        values: v.values,
        metadata: toVectorizeMetadata(v.metadata),
      })),
    );
  }
};

export const sourceIdPrefix = async (source: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source),
  );
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
};

export const vectorId = (prefix: string, index: number) => `${prefix}#${index}`;

export const readChunkCount = async (
  vectorize: VectorizeIndex,
  prefix: string,
) => {
  const [head] = await vectorize.getByIds([vectorId(prefix, 0)]);
  return (head?.metadata?.chunkCount as number | undefined) ?? 0;
};

export const deleteVectors = async (
  vectorize: VectorizeIndex,
  ids: string[],
) => {
  for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
    await vectorize.deleteByIds(ids.slice(i, i + DELETE_BATCH_SIZE));
  }
};

export const deleteKnowledgeBySource = async (
  vectorize: VectorizeIndex,
  source: string,
) => {
  const prefix = await sourceIdPrefix(source);
  const count = await readChunkCount(vectorize, prefix);
  if (count > 0) {
    await deleteVectors(
      vectorize,
      Array.from({ length: count }, (_, i) => vectorId(prefix, i)),
    );
  }
  return { deleted: count };
};
