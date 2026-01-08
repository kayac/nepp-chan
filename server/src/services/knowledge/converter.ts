import { Buffer } from "node:buffer";
import { converterAgent } from "~/mastra/agents/converter-agent";

const SUPPORTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export const isSupportedMimeType = (mimeType: string) =>
  SUPPORTED_MIME_TYPES.includes(
    mimeType as (typeof SUPPORTED_MIME_TYPES)[number],
  );

export const convertToMarkdown = async (
  fileData: ArrayBuffer,
  mimeType: string,
): Promise<string> => {
  if (!isSupportedMimeType(mimeType)) {
    throw new Error(
      `Unsupported mime type: ${mimeType}. Supported types: ${SUPPORTED_MIME_TYPES.join(", ")}`,
    );
  }

  const base64Data = Buffer.from(fileData).toString("base64");

  const result = await converterAgent.generate([
    {
      role: "user",
      content: [
        {
          type: "file",
          data: base64Data,
          mimeType,
        },
      ],
    },
  ]);

  return result.text;
};
