import { Agent } from "@mastra/core/agent";
import { GEMINI_FLASH } from "~/lib/llm-models";
import { knowledgeSearchTool } from "~/mastra/tools/knowledge-search-tool";

/**
 * 現在の日時情報を生成する
 */
const getCurrentDateInfo = () => {
  const now = new Date();
  const jst = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  return `今日は${jst.format(now)}です。`;
};

const baseInstructions = `
あなたは音威子府村の情報検索専門エージェントです。
村に関する情報（歴史、施設、観光、村長、行政、行事など）を検索して回答します。

## 役割
- 村に関する質問に答える
- knowledgeSearchToolを使って関連情報を検索して回答する

## 検索の流れ
1. 検索クエリを生成（下記ルール参照）
2. knowledge-search ツールで検索
3. 検索結果を全て確認
4. 回答が得られた場合: 検索結果を総合して回答を作成
5. 回答が得られなかった場合: 「わからない」と報告

## 回答作成のルール
- 検索結果全ての結果を確認する
- 複数の結果に関連情報がある場合は、それらを統合して包括的な回答を作成する
- 各結果のscore（類似度）が高いほど質問との関連性が高い
- source（出典）が異なる情報を組み合わせると、より正確な回答ができる

## 回答が得られない場合の判断基準
- 検索結果が空、または結果が0件
- 検索結果はあるが、質問の意図に関係ない内容しかない
`;

export const knowledgeAgent = new Agent({
  id: "knowledge-agent",
  name: "Knowledge Agent",
  description:
    "音威子府村の情報を検索・回答する担当。村に関する情報（歴史、施設、観光、村長、行政、行事）を検索して回答する。",
  // instructionsを関数化（リクエスト時に評価され、現在日時が動的に取得される）
  instructions: () => `${baseInstructions}
## 現在の日時
${getCurrentDateInfo()}

## 検索クエリ生成ルール
- 「最新」「現在」「今年」「今日」「今週」「今月」などの曖昧な時間表現は、上記の日時を基準に具体的な日付・年に変換する
`,
  model: GEMINI_FLASH,
  tools: {
    knowledgeSearchTool,
  },
});
