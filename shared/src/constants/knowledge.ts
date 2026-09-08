export const CONVERTIBLE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export const CURATED_DRAFT_LIMITS = {
  urls: 10,
  files: 5,
  filesTotalBytes: 20 * 1024 * 1024,
} as const;

export const CURATED_PREFIX = "curated/";
export const OFFICIAL_PREFIX = "official/";
export const KNOWLEDGE_PREFIXES = [OFFICIAL_PREFIX, CURATED_PREFIX] as const;
export type KnowledgePrefix = (typeof KNOWLEDGE_PREFIXES)[number];
