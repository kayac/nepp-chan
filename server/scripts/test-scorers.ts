#!/usr/bin/env tsx
/**
 * スコアラー検証スクリプト（Phase 1: 物差しのテスト）
 *
 * エージェントと Vectorize をバイパスし、人工的な回答を用いて
 * 各スコアラーが正しく評価できるかを検証する。
 *
 * 使用方法:
 *   pnpm tsx server/scripts/test-scorers.ts
 */

import {
  createAnswerSimilarityScorer,
  createContextPrecisionScorer,
  createContextRelevanceScorerLLM,
  createFaithfulnessScorer,
  createHallucinationScorer,
} from "@mastra/evals/scorers/prebuilt";
import {
  createAgentTestRun,
  createTestMessage,
} from "@mastra/evals/scorers/utils";
import { getPlatformProxy } from "wrangler";

import { GEMINI_FLASH_LITE, GEMINI_SCORER } from "../src/lib/llm-models";

// ─── テストシナリオ定義 ──────────────────────────────────────

interface ScorerTestCase {
  name: string;
  description: string;
  input: string;
  output: string;
  groundTruth: string;
  context: string[];
  expected: {
    similarity: { min: number; max: number };
    faithfulness: { min: number; max: number };
    hallucination: { min: number; max: number };
    contextPrecision: { min: number; max: number };
    contextRelevance: { min: number; max: number };
  };
}

const TEST_CASES: ScorerTestCase[] = [
  {
    name: "A: 完璧な回答",
    description: "正解テキストとほぼ同じ内容。全スコアが高いはず",
    input: "おと高の寮費はいくらですか？",
    output:
      "月額30,000円です。食費（3食）や光熱費等を含みます。学級費やPTA会費等の諸納金は別途前期に納入が必要です。",
    groundTruth:
      "月額30,000円。食費（3食）や光熱費等を含む。学級費やPTA会費等の諸納金は別途前期に納入",
    context: [
      "寮費は月額30,000円で、食費（３食）や光熱費等を含み、１年間に必要な金額を月割りしています。学級費やPTA会費等の諸納金があり、前期に納入していただきます。",
    ],
    expected: {
      similarity: { min: 0.7, max: 1.0 },
      faithfulness: { min: 0.7, max: 1.0 },
      hallucination: { min: 0.0, max: 0.3 },
      contextPrecision: { min: 0.7, max: 1.0 },
      contextRelevance: { min: 0.7, max: 1.0 },
    },
  },
  {
    name: "B: 部分的な回答",
    description: "金額のみ正しいが詳細が欠けている",
    input: "おと高の寮費はいくらですか？",
    output: "月額30,000円です。",
    groundTruth:
      "月額30,000円。食費（3食）や光熱費等を含む。学級費やPTA会費等の諸納金は別途前期に納入",
    context: [
      "寮費は月額30,000円で、食費（３食）や光熱費等を含み、１年間に必要な金額を月割りしています。学級費やPTA会費等の諸納金があり、前期に納入していただきます。",
    ],
    expected: {
      similarity: { min: 0.3, max: 0.7 },
      faithfulness: { min: 0.7, max: 1.0 },
      hallucination: { min: 0.0, max: 0.3 },
      contextPrecision: { min: 0.5, max: 1.0 },
      contextRelevance: { min: 0.7, max: 1.0 },
    },
  },
  {
    name: "C: 完全に間違った回答",
    description: "金額が違う。低スコアであるべき",
    input: "おと高の寮費はいくらですか？",
    output: "月額50,000円です。食費は含まれず、自炊が必要です。",
    groundTruth:
      "月額30,000円。食費（3食）や光熱費等を含む。学級費やPTA会費等の諸納金は別途前期に納入",
    context: [
      "寮費は月額30,000円で、食費（３食）や光熱費等を含み、１年間に必要な金額を月割りしています。学級費やPTA会費等の諸納金があり、前期に納入していただきます。",
    ],
    expected: {
      similarity: { min: 0.0, max: 0.4 },
      faithfulness: { min: 0.0, max: 0.3 },
      hallucination: { min: 0.5, max: 1.0 },
      contextPrecision: { min: 0.0, max: 0.5 },
      contextRelevance: { min: 0.5, max: 1.0 },
    },
  },
  {
    name: "D: 幻覚混入の回答",
    description: "正しい情報に加え、コンテキストにない情報を捏造",
    input: "おと高の寮費はいくらですか？",
    output:
      "月額30,000円です。食費（3食）や光熱費等を含みます。なお、寮には温泉設備があり、スキー場への無料シャトルバスも運行しています。",
    groundTruth:
      "月額30,000円。食費（3食）や光熱費等を含む。学級費やPTA会費等の諸納金は別途前期に納入",
    context: [
      "寮費は月額30,000円で、食費（３食）や光熱費等を含み、１年間に必要な金額を月割りしています。学級費やPTA会費等の諸納金があり、前期に納入していただきます。",
    ],
    expected: {
      similarity: { min: 0.3, max: 0.7 },
      faithfulness: { min: 0.0, max: 0.5 },
      hallucination: { min: 0.3, max: 1.0 },
      contextPrecision: { min: 0.5, max: 1.0 },
      contextRelevance: { min: 0.5, max: 1.0 },
    },
  },
  {
    name: "E: 棄権回答（知りません）",
    description:
      "情報がないと回答。similarity は低いが hallucination も低いはず",
    input: "おと高の寮費はいくらですか？",
    output:
      "申し訳ありませんが、おと高の寮費に関する情報が見つかりませんでした。学校に直接お問い合わせください。",
    groundTruth:
      "月額30,000円。食費（3食）や光熱費等を含む。学級費やPTA会費等の諸納金は別途前期に納入",
    context: [
      "寮費は月額30,000円で、食費（３食）や光熱費等を含み、１年間に必要な金額を月割りしています。学級費やPTA会費等の諸納金があり、前期に納入していただきます。",
    ],
    expected: {
      similarity: { min: 0.0, max: 0.3 },
      faithfulness: { min: 0.0, max: 0.5 },
      hallucination: { min: 0.0, max: 0.3 },
      contextPrecision: { min: 0.0, max: 1.0 },
      contextRelevance: { min: 0.5, max: 1.0 },
    },
  },
];

// ─── スコアラー実行 ──────────────────────────────────────────

type ScoreName =
  | "similarity"
  | "faithfulness"
  | "contextPrecision"
  | "contextRelevance"
  | "hallucination";

type Scores = Record<ScoreName, number | null>;

const runScorer = async (
  name: ScoreName,
  tc: ScorerTestCase,
): Promise<{
  score: number | null;
  durationMs: number;
  error: string | null;
}> => {
  const testRun = createAgentTestRun({
    inputMessages: [createTestMessage({ content: tc.input, role: "user" })],
    output: [createTestMessage({ content: tc.output, role: "assistant" })],
  });

  const start = Date.now();
  try {
    let result: { score?: number | null } | undefined;

    switch (name) {
      case "similarity":
        result = await createAnswerSimilarityScorer({
          model: GEMINI_FLASH_LITE,
        }).run({
          input: testRun.input,
          output: testRun.output,
          groundTruth: tc.groundTruth,
        });
        break;
      case "faithfulness":
        result = await createFaithfulnessScorer({
          model: GEMINI_SCORER,
          options: { context: tc.context },
        }).run({
          input: testRun.input,
          output: testRun.output,
        });
        break;
      case "contextPrecision":
        result = await createContextPrecisionScorer({
          model: GEMINI_FLASH_LITE,
          options: { context: tc.context },
        }).run({
          input: testRun.input,
          output: testRun.output,
          groundTruth: tc.groundTruth,
        });
        break;
      case "contextRelevance":
        result = await createContextRelevanceScorerLLM({
          model: GEMINI_SCORER,
          options: { context: tc.context },
        }).run({
          input: testRun.input,
          output: testRun.output,
        });
        break;
      case "hallucination":
        result = await createHallucinationScorer({
          model: GEMINI_FLASH_LITE,
          options: { context: tc.context },
        }).run({
          input: testRun.input,
          output: testRun.output,
        });
        break;
    }

    return {
      score: result?.score ?? null,
      durationMs: Date.now() - start,
      error: null,
    };
  } catch (e) {
    return {
      score: null,
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.message : JSON.stringify(e),
    };
  }
};

// ─── メイン ──────────────────────────────────────────────────

const SCORE_NAMES: ScoreName[] = [
  "similarity",
  "faithfulness",
  "contextPrecision",
  "contextRelevance",
  "hallucination",
];

const main = async () => {
  // .dev.vars から API キーを取得
  const { env, dispose } = await getPlatformProxy<CloudflareBindings>({
    configPath: "server/wrangler.jsonc",
  });
  // biome-ignore lint/suspicious/noExplicitAny: .dev.vars の追加キーは CloudflareBindings に未定義
  const evalKey = (env as any).EVAL_GOOGLE_API_KEY as string | undefined;
  const key = evalKey || env.GOOGLE_GENERATIVE_AI_API_KEY;
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = key;
  console.log(evalKey ? "🔑 Eval専用APIキーを使用" : "🔑 通常APIキーを使用");

  console.log("═══════════════════════════════════════════════════════════");
  console.log("🧪 スコアラー検証テスト（Phase 1: 物差しのテスト）");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`テストケース数: ${TEST_CASES.length}`);
  console.log(`スコアラー数: ${SCORE_NAMES.length}`);
  console.log(`合計評価: ${TEST_CASES.length * SCORE_NAMES.length}回\n`);

  const results: Array<{
    caseName: string;
    scores: Scores;
    passed: Record<ScoreName, boolean>;
    errors: Record<ScoreName, string | null>;
  }> = [];

  for (const tc of TEST_CASES) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📝 ${tc.name}`);
    console.log(`   ${tc.description}`);
    console.log(`   回答: "${tc.output.slice(0, 60)}..."`);

    const scores: Scores = {
      similarity: null,
      faithfulness: null,
      contextPrecision: null,
      contextRelevance: null,
      hallucination: null,
    };
    const passed: Record<ScoreName, boolean> = {} as Record<ScoreName, boolean>;
    const errors: Record<ScoreName, string | null> = {} as Record<
      ScoreName,
      string | null
    >;

    // 各スコアラーを直列実行（API レート制限を考慮）
    for (const scoreName of SCORE_NAMES) {
      process.stdout.write(`   ${scoreName.padEnd(18)} `);
      const result = await runScorer(scoreName, tc);
      scores[scoreName] = result.score;
      errors[scoreName] = result.error;

      const expected = tc.expected[scoreName];
      const score = result.score;

      if (result.error) {
        passed[scoreName] = false;
        console.log(`❌ ERROR: ${result.error}`);
      } else if (score === null) {
        passed[scoreName] = false;
        console.log(`⚠️  null (期待: ${expected.min}-${expected.max})`);
      } else {
        const inRange = score >= expected.min && score <= expected.max;
        passed[scoreName] = inRange;
        const icon = inRange ? "✅" : "❌";
        const rangeStr = `[${expected.min}-${expected.max}]`;
        console.log(
          `${icon} ${score.toFixed(3)} ${inRange ? "" : `← 期待範囲外 ${rangeStr}`} (${result.durationMs}ms)`,
        );
      }
    }

    results.push({ caseName: tc.name, scores, passed, errors });
  }

  // ─── 最終レポート ──────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📊 最終レポート");
  console.log("═══════════════════════════════════════════════════════════\n");

  // スコア一覧テーブル
  const header =
    "ケース".padEnd(20) +
    SCORE_NAMES.map((n) => n.slice(0, 8).padStart(10)).join("");
  console.log(header);
  console.log("─".repeat(header.length));

  for (const r of results) {
    const row =
      r.caseName.padEnd(20) +
      SCORE_NAMES.map((n) => {
        const s = r.scores[n];
        const p = r.passed[n];
        const val = s !== null ? s.toFixed(3) : "null";
        const icon = r.errors[n] ? "💥" : p ? "✅" : "❌";
        return `${icon}${val}`.padStart(10);
      }).join("");
    console.log(row);
  }

  // 合格率
  let totalTests = 0;
  let totalPassed = 0;
  const scorerPassCount: Record<ScoreName, { passed: number; total: number }> =
    {} as Record<ScoreName, { passed: number; total: number }>;

  for (const name of SCORE_NAMES) {
    scorerPassCount[name] = { passed: 0, total: 0 };
  }

  for (const r of results) {
    for (const name of SCORE_NAMES) {
      totalTests++;
      scorerPassCount[name].total++;
      if (r.passed[name]) {
        totalPassed++;
        scorerPassCount[name].passed++;
      }
    }
  }

  console.log("\n─── スコアラー別の合格率 ───────────────────────────────");
  for (const name of SCORE_NAMES) {
    const { passed: p, total: t } = scorerPassCount[name];
    const rate = ((p / t) * 100).toFixed(0);
    const icon = p === t ? "✅" : p >= t * 0.6 ? "⚠️" : "❌";
    console.log(`  ${icon} ${name.padEnd(18)} ${p}/${t} (${rate}%)`);
  }

  console.log(
    `\n  全体: ${totalPassed}/${totalTests} (${((totalPassed / totalTests) * 100).toFixed(0)}%)`,
  );

  // 診断コメント
  console.log("\n─── 診断 ──────────────────────────────────────────────");

  for (const name of SCORE_NAMES) {
    const { passed: p, total: t } = scorerPassCount[name];
    if (p < t) {
      console.log(`\n  ⚠ ${name}:`);
      for (const r of results) {
        if (!r.passed[name]) {
          const tc = TEST_CASES.find((c) => c.name === r.caseName)!;
          const expected = tc.expected[name];
          const actual = r.scores[name];
          const err = r.errors[name];
          if (err) {
            console.log(`    ${r.caseName}: ERROR - ${err}`);
          } else {
            console.log(
              `    ${r.caseName}: 実際=${actual?.toFixed(3) ?? "null"}, 期待=[${expected.min}-${expected.max}]`,
            );
          }
        }
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");

  await dispose();
};

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
