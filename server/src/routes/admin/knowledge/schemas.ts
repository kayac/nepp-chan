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

export const CuratedDraftRequestSchema = z.object({
  urls: z
    .any()
    .optional()
    .openapi({
      type: "array",
      items: { type: "string" },
      description: "読み取る URL（最大 10 件）",
    }),
  text: z.string().optional().openapi({ description: "貼り付けた本文" }),
  files: z
    .any()
    .optional()
    .openapi({
      type: "array",
      items: { type: "string", format: "binary" },
      description: "画像・PDF（最大 5 件、合計 20MB）",
    }),
});

export const CuratedDraftResponseSchema = z.object({
  key: z.string(),
  content: z.string(),
  readUrls: z.array(z.string()),
  unreadable: z.array(z.object({ name: z.string(), reason: z.string() })),
});

export const FileKeyParamSchema = z.object({
  key: z.string().openapi({ param: { name: "key", in: "path" } }),
});

export const validateFileKey = (key: string) => {
  if (key.includes("..") || key.startsWith("/")) {
    throw new HTTPException(400, { message: "Invalid file key" });
  }
};
