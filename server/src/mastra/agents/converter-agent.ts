import { Agent } from "@mastra/core/agent";
import { GEMINI_PRO } from "~/lib/llm-models";

const CONVERSION_INSTRUCTIONS = `
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

export const converterAgent = new Agent({
  id: "document-converter",
  name: "Document Converter",
  instructions: CONVERSION_INSTRUCTIONS,
  model: GEMINI_PRO,
});
