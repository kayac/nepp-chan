import { Agent } from "@mastra/core/agent";
import { modelWithReasoning } from "~/lib/llm-models";

const INSTRUCTIONS = `提供された画像・PDFの内容をMarkdown形式で出力する。

入力の種類に応じて出力を変える:

**文書・チラシ・PDF（テキスト中心のコンテンツ）:**
- テキストを正確に書き起こす
- 見出し・段落・リストなどの構造をMarkdownで再現する
- 表はMarkdownテーブルにする

**写真・イラスト・グラフ（ビジュアル中心のコンテンツ）:**
- 何が写っているか / 描かれているかを簡潔に説明する
- テキストが含まれていればそのまま書き起こす
- グラフや図表はデータの要点を読み取って記述する

出力はMarkdownのみ。前置きや補足説明は不要。日本語コンテンツは日本語で出力する。`;

export const converterAgent = new Agent({
  id: "document-converter",
  name: "Document Converter",
  instructions: INSTRUCTIONS,
  ...modelWithReasoning({ effort: "low" }),
});
