import { logger } from "~/lib/logger";
import { knowledgeCorrectionRepository } from "~/repository/knowledge-correction-repository";
import { knowledgeSourceRepository } from "~/repository/knowledge-source-repository";
import { deleteKnowledgeBySource, processKnowledgeFile } from "./embedding";
import { buildSourceRecord } from "./source-meta";

type IndexDeps = {
  d1: D1Database;
  vectorize: VectorizeIndex;
  apiKey: string;
};

type IndexOptions = {
  r2Etag?: string;
  approveAs?: string;
  skipUnchanged?: boolean;
};

export type IndexResult = {
  indexed: boolean;
  status: string;
  chunks: number;
  error?: string;
};

export const indexKnowledgeSource = async (
  key: string,
  content: string,
  deps: IndexDeps,
  options: IndexOptions = {},
): Promise<IndexResult> => {
  const record = await buildSourceRecord(key, content);
  const now = new Date().toISOString();
  const existing = await knowledgeSourceRepository.findByPath(deps.d1, key);

  const promoted =
    options.approveAs !== undefined &&
    (!existing || existing.approvalStatus === "pending");
  const status = promoted
    ? "approved"
    : (existing?.approvalStatus ?? "pending");

  if (
    options.skipUnchanged &&
    existing?.approvalStatus === "approved" &&
    existing.indexedAt &&
    existing.sourceHash === record.sourceHash
  ) {
    logger.info(`[Knowledge] skip indexing (unchanged): ${key}`);
    return { indexed: true, status, chunks: existing.chunkCount };
  }

  if (!existing) {
    await knowledgeSourceRepository.insert(deps.d1, {
      sourcePath: key,
      canonicalUrl: record.canonicalUrl,
      sourceType: record.sourceType,
      sourceAuthority: record.sourceAuthority,
      verifiedAt: record.verifiedAt,
      approvalStatus: status,
      approvedBy: promoted ? options.approveAs : undefined,
      approvedAt: promoted ? now : undefined,
      createdAt: now,
    });
  } else {
    if (existing.sourceHash !== record.sourceHash && existing.sourceHash) {
      await knowledgeCorrectionRepository.markNeedsReviewByCorrects(
        deps.d1,
        key,
      );
    }
    if (promoted && existing.approvalStatus === "pending") {
      await knowledgeSourceRepository.update(deps.d1, key, {
        approvalStatus: "approved",
        approvedBy: options.approveAs,
        approvedAt: now,
      });
    }
  }

  if (status !== "approved") {
    if (existing?.indexedAt) {
      await deleteKnowledgeBySource(deps.vectorize, key);
      await knowledgeSourceRepository.markRemoved(deps.d1, key);
    }
    logger.info(`[Knowledge] skip indexing (${status}): ${key}`);
    return { indexed: false, status, chunks: 0 };
  }

  await deleteKnowledgeBySource(deps.vectorize, key);
  const result = await processKnowledgeFile(
    key,
    content,
    deps.vectorize,
    deps.apiKey,
    deps.d1,
  );

  if (result.error) {
    await knowledgeSourceRepository.markRemoved(deps.d1, key);
  } else {
    const { sourcePath: _, ...meta } = record;
    await knowledgeSourceRepository.update(deps.d1, key, {
      ...meta,
      ...(options.r2Etag && { r2Etag: options.r2Etag }),
      chunkCount: result.chunks,
      indexedAt: new Date().toISOString(),
    });
  }

  return {
    indexed: true,
    status,
    chunks: result.chunks,
    ...(result.error !== undefined && { error: result.error }),
  };
};

export const removeKnowledgeSource = async (
  key: string,
  deps: Pick<IndexDeps, "d1" | "vectorize">,
) => {
  const result = await deleteKnowledgeBySource(deps.vectorize, key);
  if (await knowledgeSourceRepository.findByPath(deps.d1, key)) {
    await knowledgeSourceRepository.markRemoved(deps.d1, key);
  }
  return result;
};
