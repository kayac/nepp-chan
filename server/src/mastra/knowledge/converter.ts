import { Buffer } from "node:buffer";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const CONVERSION_PROMPT = `
あなたは文書変換のエキスパートです。
提供された画像/PDFの内容を、以下のルールに従ってMarkdown形式に変換してください：

## 変換ルール
1. 文書の構造（見出し、段落、リスト）を適切にMarkdownで表現する
2. 表がある場合はMarkdownテーブル形式にする
3. 重要な情報は強調（太字）にする
4. 画像内のテキストは正確に書き起こす
5. 読み取れない部分は[判読不能]と記載する
6. 日本語文書の場合は日本語で出力する

変換結果のMarkdownのみを出力してください。説明は不要です。
`;

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
  apiKey: string,
): Promise<string> => {
  if (!isSupportedMimeType(mimeType)) {
    throw new Error(
      `Unsupported mime type: ${mimeType}. Supported types: ${SUPPORTED_MIME_TYPES.join(", ")}`,
    );
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const base64Data = Buffer.from(fileData).toString("base64");

  const { text } = await generateText({
    model: google("gemini-2.5-pro"),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: CONVERSION_PROMPT },
          {
            type: "file",
            data: base64Data,
            mediaType: mimeType as SupportedMimeType,
          },
        ],
      },
    ],
  });

  return text;
};
