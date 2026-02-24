import { logger } from "~/lib/logger";
import { convertToMarkdown, isSupportedMimeType } from "./converter";
import { syncFile } from "./sync";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for Markdown
const MAX_CONVERT_FILE_SIZE = 20 * 1024 * 1024; // 20MB for images/PDF

type UploadDeps = {
  bucket: R2Bucket;
  vectorize: VectorizeIndex;
  apiKey: string;
};

type UploadResult = {
  key: string;
  chunks: number;
  error?: string;
};

type ConvertResult = {
  key: string;
  originalType: string;
  chunks: number;
  error?: string;
};

/**
 * Markdownファイルをアップロード
 */
export const uploadMarkdownFile = async (
  file: File,
  customFilename: string | null,
  deps: UploadDeps,
): Promise<UploadResult> => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds limit (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
    );
  }

  let key = customFilename || file.name;
  if (!key.endsWith(".md")) {
    key = `${key}.md`;
  }

  const content = await file.text();
  await deps.bucket.put(key, content, {
    httpMetadata: { contentType: "text/markdown" },
  });

  logger.info("[Upload] Uploaded file", { key, bytes: content.length });

  const result = await syncFile(key, content, {
    vectorize: deps.vectorize,
    apiKey: deps.apiKey,
  });

  return { key, chunks: result.chunks, error: result.error };
};

/**
 * 画像/PDFをMarkdownに変換してアップロード
 */
export const convertAndUpload = async (
  file: File,
  filename: string,
  deps: UploadDeps,
): Promise<ConvertResult> => {
  if (file.size > MAX_CONVERT_FILE_SIZE) {
    throw new Error(
      `File size exceeds limit (${MAX_CONVERT_FILE_SIZE / 1024 / 1024}MB)`,
    );
  }

  const mimeType = file.type;
  if (!isSupportedMimeType(mimeType)) {
    throw new Error(
      `Unsupported file type: ${mimeType}. Supported: image/png, image/jpeg, image/webp, image/gif, application/pdf`,
    );
  }

  let key = filename;
  if (!key.endsWith(".md")) {
    key = `${key}.md`;
  }

  logger.info("[Convert] Converting file", {
    fileName: file.name,
    mimeType,
    key,
  });

  const fileData = await file.arrayBuffer();
  const markdown = await convertToMarkdown(fileData, mimeType);

  logger.info("[Convert] Generated markdown", { bytes: markdown.length });

  // 元ファイルを originals/ に保存
  const originalExtension = file.name.split(".").pop() || "bin";
  const originalKey = `originals/${key.replace(/\.md$/, `.${originalExtension}`)}`;
  await deps.bucket.put(originalKey, fileData, {
    httpMetadata: { contentType: mimeType },
  });
  logger.info("[Convert] Saved original", { originalKey });

  // Markdown を R2 に保存
  await deps.bucket.put(key, markdown, {
    httpMetadata: { contentType: "text/markdown" },
  });

  const result = await syncFile(key, markdown, {
    vectorize: deps.vectorize,
    apiKey: deps.apiKey,
  });

  return {
    key,
    originalType: mimeType,
    chunks: result.chunks,
    error: result.error,
  };
};

/**
 * 元ファイルからMarkdownを再生成
 */
export const reconvertFromOriginal = async (
  originalKey: string,
  filename: string,
  deps: UploadDeps,
): Promise<ConvertResult> => {
  const object = await deps.bucket.get(originalKey);
  if (!object) {
    throw new Error("Original file not found");
  }

  const mimeType =
    object.httpMetadata?.contentType || "application/octet-stream";
  if (!isSupportedMimeType(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  let key = filename;
  if (!key.endsWith(".md")) {
    key = `${key}.md`;
  }

  logger.info("[Reconvert] Converting file", { originalKey, mimeType, key });

  const fileData = await object.arrayBuffer();
  const markdown = await convertToMarkdown(fileData, mimeType);

  logger.info("[Reconvert] Generated markdown", { bytes: markdown.length });

  await deps.bucket.put(key, markdown, {
    httpMetadata: { contentType: "text/markdown" },
  });

  const result = await syncFile(key, markdown, {
    vectorize: deps.vectorize,
    apiKey: deps.apiKey,
  });

  return {
    key,
    originalType: mimeType,
    chunks: result.chunks,
    error: result.error,
  };
};
