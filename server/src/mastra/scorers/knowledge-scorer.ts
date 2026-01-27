import { createScorer } from "@mastra/core/evals";
import { z } from "zod";

/**
 * ハルシネーション検出 Scorer
 * 回答が検索結果と矛盾していないかを評価
 * スコアは低いほど良い（0 = ハルシネーションなし、1 = 全てハルシネーション）
 */
export const knowledgeHallucinationScorer = createScorer({
  id: "knowledge-hallucination-scorer",
  name: "Knowledge Hallucination",
  description:
    "回答が検索結果と矛盾していないかを評価し、ハルシネーション率を算出する（低いほど良い）",
  type: "agent",
  judge: {
    model: "google/gemini-3-flash-preview",
    instructions: `あなたは RAG システムのハルシネーション検出の専門家です。
エージェント出力には knowledgeSearchTool のツール実行結果（検索コンテキスト）と、アシスタントの回答が含まれています。
これらを読み取り、回答に含まれる主張が検索結果と矛盾していないかを評価してください。

重要なルール:
- 検索結果に存在しない情報への言及はハルシネーション
- 検索結果と矛盾する主張はハルシネーション
- 「わからない」「情報がない」という正直な回答はハルシネーションではない
- 推測的な表現（「かもしれない」等）で検索結果にない情報に言及するのもハルシネーション`,
  },
})
  .analyze({
    description:
      "回答からクレームを抽出し、各クレームが検索結果と矛盾するか判定",
    outputSchema: z.object({
      claims: z.array(z.string()),
      verdicts: z.array(
        z.object({
          statement: z.string(),
          verdict: z.enum(["yes", "no"]),
          reason: z.string(),
        }),
      ),
    }),
    createPrompt: ({ run }) => `
エージェント出力（ツール実行結果を含む）:
${JSON.stringify(run.output, null, 2)}

タスク:
1. knowledgeSearchTool の実行結果から検索コンテキストを特定
2. アシスタントの最終回答を特定
3. 回答から事実に関する主張（クレーム）を全て抽出
4. 各クレームについて、検索結果と矛盾するかを判定:
   - "yes" = 矛盾している（ハルシネーション）
   - "no" = 矛盾していない（検索結果に根拠がある、または事実の主張ではない）
5. 判定理由を簡潔に記載
`,
  })
  .generateScore(({ results }) => {
    const r = results?.analyzeStepResult as {
      verdicts?: Array<{ verdict: string }>;
    };
    const verdicts = r?.verdicts ?? [];
    if (verdicts.length === 0) return 0;
    const hallucinations = verdicts.filter((v) => v.verdict === "yes").length;
    return hallucinations / verdicts.length;
  })
  .generateReason(({ results, score }) => {
    const r = results?.analyzeStepResult as {
      verdicts?: Array<{ statement: string; verdict: string; reason: string }>;
    };
    const verdicts = r?.verdicts ?? [];
    const hallucinations = verdicts.filter((v) => v.verdict === "yes");
    const total = verdicts.length;
    const hallucinationCount = hallucinations.length;

    if (total === 0) {
      return "評価対象のクレームがありませんでした。";
    }

    const details = hallucinations
      .slice(0, 3)
      .map((v) => `「${v.statement}」: ${v.reason}`)
      .join("; ");

    return `ハルシネーション率: ${hallucinationCount}/${total} (${(score * 100).toFixed(0)}%)。${details ? `問題のある主張: ${details}` : "問題なし。"}`;
  });

/**
 * 検索品質評価 Scorer
 * 検索結果がユーザーの質問に関連しているかを評価
 */
export const knowledgeSearchQualityScorer = createScorer({
  id: "knowledge-search-quality-scorer",
  name: "Knowledge Search Quality",
  description:
    "検索結果がユーザーの質問に関連しているかを評価する（高いほど良い）",
  type: "agent",
  judge: {
    model: "google/gemini-3-flash-preview",
    instructions: `あなたは RAG システムの検索品質評価の専門家です。
エージェント出力には knowledgeSearchTool のツール実行結果（検索コンテキスト）が含まれています。
ユーザーの質問に対して、検索結果が関連しているかを評価してください。`,
  },
})
  .analyze({
    description: "検索結果の関連性を評価",
    outputSchema: z.object({
      relevantResults: z.number(),
      totalResults: z.number(),
      relevanceScore: z.number().min(0).max(1),
      explanation: z.string(),
    }),
    createPrompt: ({ run }) => `
ユーザーの質問:
${JSON.stringify(run.input, null, 2)}

エージェント出力（ツール実行結果を含む）:
${JSON.stringify(run.output, null, 2)}

タスク:
1. knowledgeSearchTool の実行結果から検索コンテキストを特定
2. 各検索結果がユーザーの質問に関連しているかを判定
3. 関連性スコア（0-1）を算出
`,
  })
  .generateScore(({ results }) => {
    const r = results?.analyzeStepResult as { relevanceScore?: number };
    return r?.relevanceScore ?? 0;
  })
  .generateReason(({ results, score }) => {
    const r = results?.analyzeStepResult as {
      relevantResults?: number;
      totalResults?: number;
      explanation?: string;
    };
    return `関連性: ${r?.relevantResults ?? 0}/${r?.totalResults ?? 0} (${(score * 100).toFixed(0)}%)。${r?.explanation ?? ""}`;
  });

/**
 * 固有名詞・数値の正確性 Scorer
 * 村長名、人口、日付などの具体的な情報が正確かを評価
 */
export const knowledgeAccuracyScorer = createScorer({
  id: "knowledge-accuracy-scorer",
  name: "Knowledge Accuracy",
  description:
    "回答に含まれる固有名詞・数値（村長名、人口、日付など）が検索結果と一致しているかを評価する",
  type: "agent",
  judge: {
    model: "google/gemini-3-flash-preview",
    instructions: `あなたは RAG システムの情報正確性評価の専門家です。
エージェント出力には knowledgeSearchTool のツール実行結果（検索コンテキスト）と、アシスタントの回答が含まれています。
回答に含まれる固有名詞や数値が検索結果と一致しているかを評価してください。

評価対象:
- 人名（村長名など）
- 数値（人口、面積、年度など）
- 日付
- 地名
- 施設名
- その他の固有名詞

評価基準:
- 検索結果に記載された情報と完全一致するか
- 軽微な表記揺れ（漢数字/アラビア数字など）は許容
- 明らかな誤りは厳しく評価`,
  },
})
  .analyze({
    description: "回答からエンティティを抽出し、検索結果と照合",
    outputSchema: z.object({
      entities: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          valueInAnswer: z.string(),
          valueInSource: z.string().optional(),
          correct: z.boolean(),
        }),
      ),
      accuracyScore: z.number().min(0).max(1),
      explanation: z.string(),
    }),
    createPrompt: ({ run }) => `
エージェント出力（ツール実行結果を含む）:
${JSON.stringify(run.output, null, 2)}

タスク:
1. knowledgeSearchTool の実行結果から検索コンテキストを特定
2. アシスタントの最終回答を特定
3. 回答から固有名詞・数値を抽出
4. 各エンティティを検索結果と照合
5. 正確性スコアを算出
`,
  })
  .generateScore(({ results }) => {
    const r = results?.analyzeStepResult as { accuracyScore?: number };
    return r?.accuracyScore ?? 0;
  })
  .generateReason(({ results, score }) => {
    const r = results?.analyzeStepResult as {
      entities?: Array<{ name: string; correct: boolean }>;
      explanation?: string;
    };
    const incorrect = r?.entities?.filter((e) => !e.correct).length ?? 0;
    const total = r?.entities?.length ?? 0;
    return `正確性評価: ${total}件中${total - incorrect}件が正確。スコア=${score}。${r?.explanation ?? ""}`;
  });

export const knowledgeScorers = {
  knowledgeHallucinationScorer,
  knowledgeSearchQualityScorer,
  knowledgeAccuracyScorer,
};
