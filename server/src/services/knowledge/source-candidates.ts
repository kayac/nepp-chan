import type { RequestContext } from "@mastra/core/request-context";
import { logger } from "~/lib/logger";
import { hostOf, normalizeUrl } from "~/lib/url";
import { waitUntilInBackground } from "~/lib/wait-until";
import { getRequestDb } from "~/mastra/request-context";
import { knowledgeSourceRepository } from "~/repository/knowledge-source-repository";
import { sourceCandidateRepository } from "~/repository/source-candidate-repository";

const URL_PATTERN = /https?:\/\/[^\s)>"'\]]+/g;

export const extractUrls = (text: string) => [
  ...new Set(
    (text.match(URL_PATTERN) ?? [])
      .map((raw) => normalizeUrl(raw.replace(/[.,、。]+$/, "")))
      .filter((url): url is string => url !== null),
  ),
];

export const captureSourceCandidates = async (
  requestContext: RequestContext | undefined,
  text: string | undefined,
) => {
  const d1 = getRequestDb(requestContext);
  if (!d1 || !text) return;

  try {
    const urls = extractUrls(text);
    if (urls.length === 0) return;

    const canonicalUrls = await knowledgeSourceRepository.listCanonicalUrls(d1);
    const knownUrls = new Set(
      canonicalUrls
        .map(normalizeUrl)
        .filter((url): url is string => url !== null),
    );
    const knownHosts = new Set(
      [...knownUrls]
        .map(hostOf)
        .filter((host): host is string => host !== null),
    );

    const candidates = urls.filter((url) => {
      const host = hostOf(url);
      return host !== null && knownHosts.has(host) && !knownUrls.has(url);
    });
    if (candidates.length === 0) return;

    const answerRunId = requestContext?.get("answerRunId") as
      | string
      | undefined;

    for (const url of candidates) {
      const row = await sourceCandidateRepository.upsertOccurrence(d1, {
        url,
        relatedAnswerRunId: answerRunId,
      });
      if (row.occurrenceCount === 1) {
        logger.info(`[SourceCandidate] new candidate: ${url}`);
      }
    }
  } catch (error) {
    logger.warn("[SourceCandidate] failed to capture", {
      error: String(error),
    });
  }
};

export const captureSourceCandidatesInBackground = (
  requestContext: RequestContext | undefined,
  text: string | undefined,
) => {
  waitUntilInBackground(captureSourceCandidates(requestContext, text));
};
