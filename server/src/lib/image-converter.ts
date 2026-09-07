import { Buffer } from "node:buffer";
import { CONVERTIBLE_MIME_TYPES } from "@nepp-chan/shared/constants/knowledge";
import { OPENAI_LITE } from "~/lib/llm-models";
import { converterAgent } from "~/mastra/agents/converter-agent";
import { recordLlmUsage } from "~/services/analytics/llm-usage";

export const isSupportedMimeType = (mimeType: string) =>
  CONVERTIBLE_MIME_TYPES.includes(
    mimeType as (typeof CONVERTIBLE_MIME_TYPES)[number],
  );

export const convertToMarkdown = async (
  fileData: ArrayBuffer,
  mimeType: string,
  d1?: D1Database,
) => {
  if (!isSupportedMimeType(mimeType)) {
    throw new Error(
      `Unsupported mime type: ${mimeType}. Supported types: ${CONVERTIBLE_MIME_TYPES.join(", ")}`,
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

  if (d1) {
    await recordLlmUsage(d1, {
      model: result.response?.modelId ?? OPENAI_LITE,
      usage: result.totalUsage,
      source: "image-convert",
      agent: "converter",
    });
  }

  return result.text;
};
