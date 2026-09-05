import { convertToMarkdown, isSupportedMimeType } from "~/lib/image-converter";
import { logger } from "~/lib/logger";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for Markdown
const MAX_CONVERT_FILE_SIZE = 20 * 1024 * 1024; // 20MB for images/PDF

type UploadDeps = {
  bucket: R2Bucket;
  d1?: D1Database;
};

const storeMarkdown = (bucket: R2Bucket, key: string, markdown: string) =>
  bucket.put(key, markdown, { httpMetadata: { contentType: "text/markdown" } });

const withMarkdownExtension = (name: string) =>
  name.endsWith(".md") ? name : `${name}.md`;

export const uploadMarkdownFile = async (
  file: File,
  customFilename: string | null,
  deps: UploadDeps,
) => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds limit (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
    );
  }

  const key = withMarkdownExtension(customFilename || file.name);
  const content = await file.text();
  logger.info(`[Upload] Uploaded ${key} (${content.length} bytes)`);

  await storeMarkdown(deps.bucket, key, content);
  return { key };
};

export const convertAndUpload = async (
  file: File,
  filename: string,
  deps: UploadDeps,
) => {
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

  const key = withMarkdownExtension(filename);
  logger.info(`[Convert] Converting ${file.name} (${mimeType}) to ${key}`);

  const fileData = await file.arrayBuffer();
  const markdown = await convertToMarkdown(fileData, mimeType, deps.d1);
  logger.info(`[Convert] Generated ${markdown.length} bytes of markdown`);

  const originalExtension = file.name.split(".").pop() || "bin";
  const originalKey = `originals/${key.replace(/\.md$/, `.${originalExtension}`)}`;
  await deps.bucket.put(originalKey, fileData, {
    httpMetadata: { contentType: mimeType },
  });
  logger.info(`[Convert] Saved original to ${originalKey}`);

  await storeMarkdown(deps.bucket, key, markdown);
  return { key, originalType: mimeType };
};

export const reconvertFromOriginal = async (
  originalKey: string,
  filename: string,
  deps: UploadDeps,
) => {
  const object = await deps.bucket.get(originalKey);
  if (!object) {
    throw new Error("Original file not found");
  }

  const mimeType =
    object.httpMetadata?.contentType || "application/octet-stream";
  if (!isSupportedMimeType(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  const key = withMarkdownExtension(filename);
  logger.info(`[Reconvert] Converting ${originalKey} (${mimeType}) to ${key}`);

  const fileData = await object.arrayBuffer();
  const markdown = await convertToMarkdown(fileData, mimeType, deps.d1);
  logger.info(`[Reconvert] Generated ${markdown.length} bytes of markdown`);

  await storeMarkdown(deps.bucket, key, markdown);
  return { key, originalType: mimeType };
};
