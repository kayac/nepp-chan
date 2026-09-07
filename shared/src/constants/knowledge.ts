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
