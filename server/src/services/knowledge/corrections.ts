import { logger } from "~/lib/logger";
import {
  type KnowledgeCorrection,
  knowledgeCorrectionRepository,
} from "~/repository/knowledge-correction-repository";
import { indexKnowledgeSource } from "./indexing";
import type { KnowledgeResult } from "./search";

export const CURATED_CORRECTIONS_PREFIX = "curated/corrections/";
export const CORRECTION_SOURCE_AUTHORITY = 2;

export const correctionSourcePath = (id: string) =>
  `${CURATED_CORRECTIONS_PREFIX}${id}.md`;

export const buildCorrectionMarkdown = (
  correction: Pick<
    KnowledgeCorrection,
    "correctsSourcePath" | "body" | "verifiedAt"
  >,
  options: { canonicalUrl?: string } = {},
) => {
  const frontmatter = [
    "---",
    "source_type: curated",
    `source_authority: ${CORRECTION_SOURCE_AUTHORITY}`,
    `verified_at: '${correction.verifiedAt}'`,
    `corrects: ${correction.correctsSourcePath}`,
    ...(options.canonicalUrl ? [`url: '${options.canonicalUrl}'`] : []),
    "---",
  ].join("\n");

  return `${frontmatter}
# 村による訂正

${correction.correctsSourcePath} の記載は古いか誤りがあります。正しくは以下のとおりです（${correction.verifiedAt} 村確認）。

${correction.body}
`;
};

type PublishDeps = {
  d1: D1Database;
  bucket: R2Bucket;
  vectorize: VectorizeIndex;
  apiKey: string;
};

export const publishCorrection = async (
  deps: PublishDeps,
  correction: KnowledgeCorrection,
  options: { canonicalUrl?: string } = {},
) => {
  const path = correctionSourcePath(correction.id);
  const markdown = buildCorrectionMarkdown(correction, options);

  await deps.bucket.put(path, markdown, {
    httpMetadata: { contentType: "text/markdown" },
  });

  return indexKnowledgeSource(
    path,
    markdown,
    { d1: deps.d1, vectorize: deps.vectorize, apiKey: deps.apiKey },
    { approveAs: correction.approvedBy },
  );
};

const toCorrectionResult = (
  correction: KnowledgeCorrection,
): KnowledgeResult => ({
  content: `${correction.correctsSourcePath} への村による訂正（${correction.verifiedAt} 村確認）:\n${correction.body}`,
  score: 1,
  source: correctionSourcePath(correction.id),
  title: "村による訂正",
  date: correction.verifiedAt,
  dateType: "verified",
});

export const applyCorrections = async (
  d1: D1Database,
  results: KnowledgeResult[],
) => {
  try {
    const sourcePaths = [
      ...new Set(
        results
          .map((result) => result.source)
          .filter((source) => !source.startsWith(CURATED_CORRECTIONS_PREFIX)),
      ),
    ];
    const corrections =
      await knowledgeCorrectionRepository.listPublishedByCorrects(
        d1,
        sourcePaths,
      );
    if (corrections.length === 0) return results;

    const presentSources = new Set(results.map((result) => result.source));
    const additions = corrections
      .filter(
        (correction) =>
          !presentSources.has(correctionSourcePath(correction.id)),
      )
      .map(toCorrectionResult);

    return [...results, ...additions];
  } catch (error) {
    logger.warn("[Corrections] failed to apply corrections", {
      error: String(error),
    });
    return results;
  }
};
