import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

export const SuccessResponseSchema = z.object({
  message: z.string(),
  count: z.number().optional(),
});

export const FileInfoSchema = z.object({
  key: z.string(),
  size: z.number(),
  lastModified: z.string(),
  etag: z.string(),
  edited: z.boolean().optional(),
});

export const FilesListResponseSchema = z.object({
  files: z.array(FileInfoSchema),
  truncated: z.boolean(),
});

export const UnifiedFileInfoSchema = z.object({
  baseName: z.string(),
  original: z
    .object({
      key: z.string(),
      size: z.number(),
      lastModified: z.string(),
      contentType: z.string(),
    })
    .optional(),
  markdown: z
    .object({
      key: z.string(),
      size: z.number(),
      lastModified: z.string(),
    })
    .optional(),
  hasMarkdown: z.boolean(),
});

export const UnifiedFilesListResponseSchema = z.object({
  files: z.array(UnifiedFileInfoSchema),
  truncated: z.boolean(),
});

export const FileContentResponseSchema = z.object({
  key: z.string(),
  content: z.string(),
  contentType: z.string(),
  size: z.number(),
  lastModified: z.string(),
});

export const SaveFileRequestSchema = z.object({
  content: z.string(),
});

export const FileKeyParamSchema = z.object({
  key: z.string().openapi({ param: { name: "key", in: "path" } }),
});

export const validateFileKey = (key: string) => {
  if (key.includes("..") || key.startsWith("/")) {
    throw new HTTPException(400, { message: "Invalid file key" });
  }
};

export const requireApiKey = (apiKey: string | undefined): string => {
  if (!apiKey) {
    throw new HTTPException(500, {
      message: "GOOGLE_GENERATIVE_AI_API_KEY is not configured",
    });
  }
  return apiKey;
};
