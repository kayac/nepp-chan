import { logger } from "~/lib/logger";
import type { ChunkMetadata } from "./chunk";

export const EMBEDDING_DIMENSIONS = 1536;
const UPSERT_BATCH_SIZE = 100;
const MAX_DELETE_ITERATIONS = 1000;
const DELETE_QUERY_TOP_K = 100;

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

const deleteMatching = async (
  vectorize: VectorizeIndex,
  filter: VectorizeVectorMetadataFilter | undefined,
) => {
  const dummyVector = new Array(EMBEDDING_DIMENSIONS).fill(0);
  let totalDeleted = 0;

  for (let i = 0; i < MAX_DELETE_ITERATIONS; i++) {
    const results = await vectorize.query(dummyVector, {
      topK: DELETE_QUERY_TOP_K,
      returnMetadata: "none",
      filter,
    });

    if (results.matches.length === 0) break;

    const ids = results.matches.map((m) => m.id);
    await vectorize.deleteByIds(ids);
    totalDeleted += ids.length;
  }

  return {
    deleted: totalDeleted,
    hitLimit: totalDeleted >= MAX_DELETE_ITERATIONS * DELETE_QUERY_TOP_K,
  };
};

const warnIfLimited = (hitLimit: boolean, target: string) => {
  if (hitLimit) {
    logger.warn(
      `[Knowledge] delete of ${target} reached iteration limit (${MAX_DELETE_ITERATIONS}), some vectors may remain`,
    );
  }
};

export const deleteAllKnowledge = async (vectorize: VectorizeIndex) => {
  const { deleted, hitLimit } = await deleteMatching(vectorize, undefined);
  warnIfLimited(hitLimit, "all vectors");
  return { deleted };
};

export const deleteKnowledgeBySource = async (
  vectorize: VectorizeIndex,
  source: string,
) => {
  const { deleted, hitLimit } = await deleteMatching(vectorize, {
    source: { $eq: source },
  });
  warnIfLimited(hitLimit, source);
  return { deleted };
};
