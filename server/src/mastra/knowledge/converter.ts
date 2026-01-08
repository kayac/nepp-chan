import { Buffer } from "node:buffer";
import { converterAgent } from "~/mastra/agents/converter-agent";

type SupportedMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/gif"
  | "application/pdf";

const SUPPORTED_MIME_TYPES: SupportedMimeType[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export const isSupportedMimeType = (
  mimeType: string,
): mimeType is SupportedMimeType =>
  SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType);

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
          mimeType: mimeType as SupportedMimeType,
        },
      ],
    },
  ]);

  return result.text;
};
