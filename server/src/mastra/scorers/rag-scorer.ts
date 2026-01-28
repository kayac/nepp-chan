import { createScorer } from "@mastra/core/evals";
import {
  createContextPrecisionScorer,
  createContextRelevanceScorerLLM,
} from "@mastra/evals/scorers/prebuilt";
import { z } from "zod";

import { extractKnowledgeContext } from "./utils/context-extractor";

const JUDGE_MODEL = "google/gemini-3-flash-preview";

/**
 * RAG Faithfulness Scorer
 * 応答がコンテキストに忠実かを評価（幻覚検出）
 * スコアは高いほど良い（1 = 幻覚なし、0 = 全てハルシネーション）
 *
 * 注: ビルトインの createFaithfulnessScorer は contextExtractor をサポートしていないため、
 * カスタムスコアラーとして実装
 */
export const ragFaithfulnessScorer = createScorer({
  id: "rag-faithfulness-scorer",
  name: "RAG Faithfulness",
  description:
    "応答がコンテキストに忠実かを評価し、幻覚率を算出する（高いほど良い）",
  type: "agent",
  judge: {
    model: JUDGE_MODEL,
    instructions: `あなたは RAG システムの忠実性評価の専門家です。
エージェント出力には knowledge-search ツールの実行結果（検索コンテキスト）と、アシスタントの回答が含まれています。
回答に含まれる主張が検索結果に基づいているかを評価してください。

評価基準:
- "yes" = 主張が検索結果に根拠がある、または事実の主張ではない
- "no" = 主張が検索結果に根拠がない（ハルシネーション）
- "unsure" = 判断が難しい

重要なルール:
- 検索結果に存在しない情報への言及はハルシネーション
- 検索結果と矛盾する主張はハルシネーション
- 「わからない」「情報がない」という正直な回答はハルシネーションではない
- 推測的な表現（「かもしれない」等）で検索結果にない情報に言及するのもハルシネーション`,
  },
})
  .preprocess(({ run }) => {
    const context = extractKnowledgeContext(run.input, run.output);
    return { context };
  })
  .analyze({
    description: "回答からクレームを抽出し、各クレームが検索結果に基づくか判定",
    outputSchema: z.object({
      claims: z.array(z.string()),
      verdicts: z.array(
        z.object({
          statement: z.string(),
          verdict: z.enum(["yes", "no", "unsure"]),
          reason: z.string(),
        }),
      ),
    }),
    createPrompt: ({ run, results }) => {
      const preprocessResult = results?.preprocessStepResult as {
        context?: string[];
      };
      const context = preprocessResult?.context ?? [];

      return `
検索コンテキスト:
${context.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}

エージェント出力:
${JSON.stringify(run.output, null, 2)}

タスク:
1. アシスタントの最終回答を特定
2. 回答から事実に関する主張（クレーム）を全て抽出
3. 各クレームについて、検索結果に根拠があるかを判定:
   - "yes" = 検索結果に根拠がある
   - "no" = 検索結果に根拠がない（ハルシネーション）
   - "unsure" = 判断が難しい
4. 判定理由を簡潔に記載
`;
    },
  })
  .generateScore(({ results }) => {
    const r = results?.analyzeStepResult as {
      verdicts?: Array<{ verdict: string }>;
    };
    const verdicts = r?.verdicts ?? [];
    if (verdicts.length === 0) return 1;
    const faithful = verdicts.filter(
      (v) => v.verdict === "yes" || v.verdict === "unsure",
    ).length;
    return faithful / verdicts.length;
  })
  .generateReason(({ results, score }) => {
    const r = results?.analyzeStepResult as {
      verdicts?: Array<{ statement: string; verdict: string; reason: string }>;
    };
    const verdicts = r?.verdicts ?? [];
    const hallucinations = verdicts.filter((v) => v.verdict === "no");
    const total = verdicts.length;
    const faithfulCount = total - hallucinations.length;

    if (total === 0) {
      return "評価対象のクレームがありませんでした。";
    }

    const details = hallucinations
      .slice(0, 3)
      .map((v) => `「${v.statement}」: ${v.reason}`)
      .join("; ");

    return `忠実性: ${faithfulCount}/${total} (${(score * 100).toFixed(0)}%)。${details ? `問題のある主張: ${details}` : "全て検索結果に基づいています。"}`;
  });

/**
 * RAG Context Precision Scorer (ビルトイン)
 * コンテキストのランキング品質を評価（Mean Average Precision）
 * スコアは高いほど良い（関連コンテキストが上位にある）
 */
export const ragContextPrecisionScorer = createContextPrecisionScorer({
  model: JUDGE_MODEL,
  options: {
    contextExtractor: extractKnowledgeContext,
    scale: 1,
  },
});

/**
 * RAG Context Relevance Scorer (ビルトイン)
 * コンテキストの関連性・利用度を評価
 * スコアは高いほど良い（検索結果が有効に活用されている）
 */
export const ragContextRelevanceScorer = createContextRelevanceScorerLLM({
  model: JUDGE_MODEL,
  options: {
    contextExtractor: extractKnowledgeContext,
    penalties: {
      unusedHighRelevanceContext: 0.1,
      missingContextPerItem: 0.1,
      maxMissingContextPenalty: 0.5,
    },
  },
});
