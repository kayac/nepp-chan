#!/usr/bin/env tsx
/**
 * Eval V2: neppChanAgent 繰り返しスコアリング + HTMLレポート
 *
 * 同じ質問をN回繰り返し実行し、5種スコアラーで自動評価。
 * レーダーチャート + 時系列グラフの HTMLレポート + JSON を出力する。
 *
 * 使用方法:
 *   pnpm eval:v2                                         # 全テストケース × 各100回
 *   pnpm eval:v2 -- --question "音威子府村の人口は？" --truth "約588人" --n 50
 *   pnpm eval:v2 -- --case 0 --n 30                      # テストケース指定
 *   pnpm eval:v2 -- --agent nepp-chan                     # エージェント選択
 *   pnpm eval:v2 -- --env development --n 10              # dev 環境で実行
 *   pnpm eval:v2 -- --compare --question "..." --truth "..." --n 3  # 3環境比較（単一質問）
 *   pnpm eval:v2 -- --compare --category education --n 3            # 3環境比較（カテゴリ）
 *   pnpm eval:v2 -- --compare --n 3                                 # 3環境比較（全テストケース）
 *   pnpm eval:v2 -- --interval 10 --n 3                              # テストケース間に10秒インターバル
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { RequestContext } from "@mastra/core/request-context";
import {
  createAnswerSimilarityScorer,
  createContextPrecisionScorer,
  createContextRelevanceScorerLLM,
  createHallucinationScorer,
} from "@mastra/evals/scorers/prebuilt";
import {
  createAgentTestRun,
  createTestMessage,
} from "@mastra/evals/scorers/utils";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { getPlatformProxy } from "wrangler";

import { OPENAI_SCORER } from "../src/lib/llm-models";
import { knowledgeAgent } from "../src/mastra/agents/knowledge-agent";
import { createNeppChanAgent } from "../src/mastra/agents/nepp-chan-agent";
import type {
  TestCase,
  TestCategory,
} from "../src/mastra/data/eval-test-cases";
import { evalTestCases } from "../src/mastra/data/eval-test-cases";
import { evalV2TestCases } from "../src/mastra/data/eval-v2-test-cases";

// ─── Types ───────────────────────────────────────────────

const SCORE_NAMES = [
  "similarity",
  "faithfulness",
  "contextPrecision",
  "contextRelevance",
  "hallucination",
] as const;
type ScoreName = (typeof SCORE_NAMES)[number];
type Scores = Record<ScoreName, number | null>;

/** 各指標の日本語名と1行説明 */
const SCORE_DESCRIPTIONS: Record<
  ScoreName,
  { label: string; description: string }
> = {
  similarity: {
    label: "類似度",
    description: "回答と正解の意味的な近さ（1.0 = 完全一致）",
  },
  faithfulness: {
    label: "忠実度",
    description:
      "回答が検索結果に基づいているか（⚠ 既知バグにより常に0 — スキップ中）",
  },
  contextPrecision: {
    label: "文脈精度",
    description:
      "検索結果のうち正解に関連するものが上位に来ているか（1.0 = 最適な順位）",
  },
  contextRelevance: {
    label: "文脈関連度",
    description: "検索結果が質問にどれだけ関連しているか（1.0 = 全て関連）",
  },
  hallucination: {
    label: "幻覚度",
    description:
      "検索結果にない情報を捏造していないか（0.0 = 捏造なし ← 低いほど良い）",
  },
};

const ENV_NAMES = ["local", "development", "production"] as const;
type EnvName = (typeof ENV_NAMES)[number];

const ENV_LABELS: Record<EnvName, string> = {
  local: "local",
  development: "dev",
  production: "prd",
};

const ENV_COLORS: Record<EnvName, string> = {
  local: "rgb(54, 162, 235)",
  development: "rgb(75, 192, 192)",
  production: "rgb(255, 99, 132)",
};

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface ToolCall {
  toolName: string;
  // biome-ignore lint/suspicious/noExplicitAny: ツール引数の型は不定
  args: Record<string, any>;
  // biome-ignore lint/suspicious/noExplicitAny: ツール結果の型は不定
  result: any;
}

interface TranscriptStep {
  stepNumber: number;
  toolCalls: ToolCall[];
}

interface IterationResult {
  iteration: number;
  answer: string;
  scores: Scores;
  durationMs: number;
  usage: TokenUsage | null;
  error: string | null;
  transcript: TranscriptStep[];
  stepCount: number;
  toolCallCount: number;
  hasAnswer: boolean;
  isAbstention: boolean;
}

interface EvalResult {
  metadata: {
    question: string;
    groundTruth: string;
    agent: string;
    environment: string;
    iterations: number;
    completedIterations: number;
    timestamp: string;
    totalDurationMs: number;
    totalTokens: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
  summary: {
    averageScores: Record<ScoreName, number | null>;
    stdDev: Record<ScoreName, number | null>;
    min: Record<ScoreName, number | null>;
    max: Record<ScoreName, number | null>;
    metrics: {
      avgStepCount: number;
      avgToolCallCount: number;
      abstentionCount: number;
      abstentionRate: number;
    };
  };
  timeline: IterationResult[];
}

interface CompareEntry {
  env: EnvName;
  result: EvalResult;
}

interface MultiCaseCompareEntry {
  testCase: TestCase;
  entries: CompareEntry[];
}

interface CliArgs {
  question?: string;
  truth?: string;
  n: number;
  agent: "knowledge" | "nepp-chan";
  caseIndex?: number;
  category?: TestCategory;
  env: EnvName;
  compare: boolean;
  /** テストケース間のインターバル（秒）。デフォルト5秒 */
  interval: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Abstention 判定 ─────────────────────────────────────

const ABSTENTION_PATTERNS = [
  "見つかりませんでした",
  "該当する情報",
  "わかりませんでした",
];

const isAbstention = (answer: string): boolean => {
  if (answer.trim().length === 0) return true;
  const lower = answer.toLowerCase();
  return ABSTENTION_PATTERNS.some((p) => lower.includes(p));
};

// ─── Eval用APIキー解決 ───────────────────────────────────

const resolveEvalApiKeys = (env: CloudflareBindings): void => {
  // Gemini（エージェント実行用）
  // biome-ignore lint/suspicious/noExplicitAny: .dev.vars の追加キーは CloudflareBindings に未定義
  const evalGoogleKey = (env as any).EVAL_GOOGLE_API_KEY as string | undefined;
  const googleKey = evalGoogleKey || env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (evalGoogleKey) {
    console.log("🔑 Eval専用Google APIキーを使用");
  }
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = googleKey;

  // OpenAI（スコアラー用）
  // biome-ignore lint/suspicious/noExplicitAny: .dev.vars の追加キーは CloudflareBindings に未定義
  const openaiKey = (env as any).OPENAI_API_KEY as string | undefined;
  if (openaiKey) {
    process.env.OPENAI_API_KEY = openaiKey;
    console.log("🔑 OpenAI APIキーを使用（スコアラー: gpt-5-nano）");
  } else {
    console.warn(
      "⚠️ OPENAI_API_KEY が未設定。スコアラーが失敗する可能性があります",
    );
  }
};

// ─── CLI引数パース ────────────────────────────────────────

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    n: 100,
    agent: "knowledge",
    env: "local",
    compare: false,
    interval: 5,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--question":
        result.question = args[++i];
        break;
      case "--truth":
        result.truth = args[++i];
        break;
      case "--n":
        result.n = Number.parseInt(args[++i], 10);
        break;
      case "--agent":
        result.agent = args[++i] as CliArgs["agent"];
        break;
      case "--case":
        result.caseIndex = Number.parseInt(args[++i], 10);
        break;
      case "--env":
        result.env = args[++i] as EnvName;
        break;
      case "--compare":
        result.compare = true;
        break;
      case "--category":
        result.category = args[++i] as TestCategory;
        break;
      case "--interval":
        result.interval = Number.parseInt(args[++i], 10);
        break;
    }
  }

  return result;
};

// ─── ナレッジ検索結果の抽出 ────────────────────────────────

const KNOWLEDGE_TOOL_NAME = "knowledgeSearchTool";

const extractKnowledgeSearchResults = (
  // biome-ignore lint/suspicious/noExplicitAny: ツール結果の型は不定
  steps: Array<{ toolResults?: any[] }> | undefined,
): Array<{ score: number; content: string; source: string }> => {
  if (!steps) return [];

  for (const step of steps) {
    if (!step.toolResults) continue;
    for (const toolResult of step.toolResults) {
      const tr = toolResult?.payload ?? toolResult;
      if (tr?.toolName !== KNOWLEDGE_TOOL_NAME || !tr?.result?.results)
        continue;

      // biome-ignore lint/suspicious/noExplicitAny: ツール結果の型は不定
      return tr.result.results.map((r: any) => ({
        score: r.score,
        content: r.content,
        source: r.source,
      }));
    }
  }
  return [];
};

// ─── Transcript 抽出 ────────────────────────────────────

const extractTranscript = (
  // biome-ignore lint/suspicious/noExplicitAny: agent.generate の戻り値型は不定
  steps: Array<{ toolResults?: any[]; toolCalls?: any[] }> | undefined,
): TranscriptStep[] => {
  if (!steps) return [];
  return steps.map((step, index) => ({
    stepNumber: index + 1,
    toolCalls: (step.toolResults ?? step.toolCalls ?? []).map(
      // biome-ignore lint/suspicious/noExplicitAny: ツール結果の型は不定
      (tc: any) => {
        const payload = tc?.payload ?? tc;
        return {
          toolName: payload?.toolName ?? "unknown",
          args: payload?.args ?? {},
          result: payload?.result ?? null,
        };
      },
    ),
  }));
};

// ─── スコアラー実行 ───────────────────────────────────────

const runEvalScorers = async ({
  input,
  output,
  groundTruth,
  context,
  abstention = false,
}: {
  input: string;
  output: string;
  groundTruth: string;
  context: string[];
  abstention?: boolean;
}): Promise<Scores> => {
  const testRun = createAgentTestRun({
    inputMessages: [createTestMessage({ content: input, role: "user" })],
    output: [createTestMessage({ content: output, role: "assistant" })],
  });

  const scores: Scores = {
    similarity: null,
    faithfulness: null,
    contextPrecision: null,
    contextRelevance: null,
    hallucination: null,
  };

  // similarity は常に実行
  try {
    const result = await createAnswerSimilarityScorer({
      model: OPENAI_SCORER,
    }).run({
      input: testRun.input,
      output: testRun.output,
      groundTruth,
    });
    scores.similarity = result?.score ?? null;
  } catch (e) {
    console.warn("  ⚠ similarity scorer failed:", (e as Error).message);
  }

  // context が空の場合は similarity のみ
  if (context.length === 0) return scores;

  // faithfulness: 常に 0.000 を返す既知バグのためスキップ
  // see: Phase 1 スコアラー検証結果（完璧な回答でも 0.000）
  // TODO: Mastra/Gemini のバグ修正後に再有効化

  try {
    const result = await createContextPrecisionScorer({
      model: OPENAI_SCORER,
      options: { context },
    }).run({
      input: testRun.input,
      output: testRun.output,
      groundTruth,
    });
    scores.contextPrecision = result?.score ?? null;
  } catch (e) {
    console.warn("  ⚠ contextPrecision scorer failed:", (e as Error).message);
  }

  // contextRelevance: Gemini の構造化出力が間欠的に失敗するためリトライ付き
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await createContextRelevanceScorerLLM({
        model: OPENAI_SCORER,
        options: { context },
      }).run({
        input: testRun.input,
        output: testRun.output,
      });
      scores.contextRelevance = result?.score ?? null;
      break;
    } catch (e) {
      if (attempt === 0) {
        // 1回目失敗 → リトライ
      } else {
        console.warn(
          "  ⚠ contextRelevance scorer failed (2 attempts):",
          (e as Error).message,
        );
      }
    }
  }

  // hallucination: 棄権回答では誤判定（1.000）するためスキップ
  // see: Phase 1 スコアラー検証結果（棄権回答に hallucination=1.000）
  if (abstention) {
    // 棄権回答は捏造ではないため null（スキップ）
  } else {
    try {
      const result = await createHallucinationScorer({
        model: OPENAI_SCORER,
        options: { context },
      }).run({
        input: testRun.input,
        output: testRun.output,
      });
      scores.hallucination = result?.score ?? null;
    } catch (e) {
      console.warn("  ⚠ hallucination scorer failed:", (e as Error).message);
    }
  }

  return scores;
};

// ─── 統計計算 ─────────────────────────────────────────────

const calcStats = (timeline: IterationResult[]) => {
  const avg = {} as Record<ScoreName, number | null>;
  const stdDev = {} as Record<ScoreName, number | null>;
  const min = {} as Record<ScoreName, number | null>;
  const max = {} as Record<ScoreName, number | null>;

  for (const name of SCORE_NAMES) {
    const values = timeline
      .map((r) => r.scores[name])
      .filter((v): v is number => v !== null);

    if (values.length === 0) {
      avg[name] = null;
      stdDev[name] = null;
      min[name] = null;
      max[name] = null;
      continue;
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    avg[name] = Math.round(mean * 1000) / 1000;
    min[name] = Math.round(Math.min(...values) * 1000) / 1000;
    max[name] = Math.round(Math.max(...values) * 1000) / 1000;

    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    stdDev[name] = Math.round(Math.sqrt(variance) * 1000) / 1000;
  }

  const completed = timeline.filter((r) => !r.error);
  const avgStepCount =
    completed.length > 0
      ? Math.round(
          (completed.reduce((sum, r) => sum + r.stepCount, 0) /
            completed.length) *
            100,
        ) / 100
      : 0;
  const avgToolCallCount =
    completed.length > 0
      ? Math.round(
          (completed.reduce((sum, r) => sum + r.toolCallCount, 0) /
            completed.length) *
            100,
        ) / 100
      : 0;
  const abstentionCount = timeline.filter((r) => r.isAbstention).length;
  const abstentionRate =
    timeline.length > 0
      ? Math.round((abstentionCount / timeline.length) * 1000) / 1000
      : 0;

  return {
    averageScores: avg,
    stdDev,
    min,
    max,
    metrics: {
      avgStepCount,
      avgToolCallCount,
      abstentionCount,
      abstentionRate,
    },
  };
};

// ─── ファイル名生成 ───────────────────────────────────────

const generateFilePrefix = (
  envLabel: string,
  agent: string,
  question: string,
  n: number,
): string => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const slug = question.slice(0, 10).replace(/[?？\s/\\]/g, "");
  return `${date}_${time}_${envLabel}_${agent}_${slug}_n${n}`;
};

// ─── HTML生成 ─────────────────────────────────────────────

const generateHtml = (result: EvalResult): string => {
  const { metadata, summary, timeline } = result;

  const scoreLabels = JSON.stringify(SCORE_NAMES);
  const avgValues = JSON.stringify(
    SCORE_NAMES.map((n) => summary.averageScores[n] ?? 0),
  );

  // 時系列データ
  const colors = [
    "rgb(54, 162, 235)",
    "rgb(255, 99, 132)",
    "rgb(75, 192, 192)",
    "rgb(255, 206, 86)",
    "rgb(153, 102, 255)",
  ];
  const timelineDatasets = SCORE_NAMES.map((name, i) => ({
    label: name,
    data: timeline.map((r) => r.scores[name]),
    borderColor: colors[i],
    backgroundColor: `${colors[i].replace("rgb", "rgba").replace(")", ", 0.1)")}`,
    tension: 0.3,
    pointRadius: timeline.length > 50 ? 0 : 3,
  }));

  const iterationLabels = JSON.stringify(timeline.map((r) => r.iteration));

  // 回答一覧
  const answersHtml = timeline
    .map((r) => {
      const scoresText = SCORE_NAMES.map(
        (n) =>
          `${n}: ${r.scores[n] !== null ? r.scores[n]?.toFixed(3) : "N/A"}`,
      ).join(" | ");
      const metricsText = `steps=${r.stepCount} tools=${r.toolCallCount}${r.isAbstention ? " [abstention]" : ""}`;
      const escapedAnswer = (
        r.isAbstention && r.answer.trim().length === 0
          ? "Abstention（該当なし）"
          : r.answer
      )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
      const errorHtml = r.error
        ? `<p style="color:red;">Error: ${r.error}</p>`
        : "";
      const transcriptHtml =
        r.transcript.length > 0
          ? `<details style="margin-top:8px;">
        <summary style="font-size:0.8rem;color:#6b7280;">Transcript (${r.transcript.length} steps)</summary>
        <pre style="font-size:0.75rem;background:#f3f4f6;padding:8px;border-radius:4px;overflow-x:auto;max-height:400px;">${JSON.stringify(r.transcript, null, 2).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
      </details>`
          : "";
      return `<details>
  <summary>#${r.iteration} (${r.durationMs}ms) ${metricsText} — ${scoresText}</summary>
  <div class="answer-detail">
    ${errorHtml}
    <p>${escapedAnswer}</p>
    ${transcriptHtml}
  </div>
</details>`;
    })
    .join("\n");

  // サマリーテーブル行
  const summaryRows = SCORE_NAMES.map((name) => {
    const desc = SCORE_DESCRIPTIONS[name];
    return `<tr>
        <td><strong>${desc.label}</strong><br><small style="color:#888">${desc.description}</small></td>
        <td>${summary.averageScores[name]?.toFixed(3) ?? "N/A"}</td>
        <td>${summary.stdDev[name]?.toFixed(3) ?? "N/A"}</td>
        <td>${summary.min[name]?.toFixed(3) ?? "N/A"}</td>
        <td>${summary.max[name]?.toFixed(3) ?? "N/A"}</td>
      </tr>`;
  }).join("\n");

  // 計測指標テーブル
  const { metrics } = summary;
  const metricsHtml = `
    <div class="card" style="margin-bottom:0;">
      <h2>計測指標</h2>
      <table>
        <thead><tr><th>指標</th><th>値</th></tr></thead>
        <tbody>
          <tr><td>平均ステップ数</td><td>${metrics.avgStepCount}</td></tr>
          <tr><td>平均ツール呼び出し数</td><td>${metrics.avgToolCallCount}</td></tr>
          <tr><td>Abstention（該当なし）</td><td>${metrics.abstentionCount} / ${metadata.completedIterations + (timeline.length - metadata.completedIterations)}</td></tr>
          <tr><td>Abstention率</td><td>${(metrics.abstentionRate * 100).toFixed(1)}%</td></tr>
        </tbody>
      </table>
    </div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Eval V2: ${metadata.question} (${metadata.environment})</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; padding: 24px; }
  h1 { font-size: 1.4rem; margin-bottom: 8px; }
  .meta { color: #666; font-size: 0.9rem; margin-bottom: 24px; line-height: 1.6; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  .card { background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .card h2 { font-size: 1.1rem; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #f8f8f8; font-weight: 600; }
  canvas { max-height: 350px; }
  details { border-bottom: 1px solid #eee; }
  summary { padding: 8px 0; cursor: pointer; font-size: 0.85rem; font-family: monospace; }
  .answer-detail { padding: 8px 16px 16px; font-size: 0.85rem; line-height: 1.6; background: #fafafa; }
</style>
</head>
<body>

<h1>Eval V2 Report</h1>
<div class="meta">
  <strong>質問:</strong> ${metadata.question}<br>
  <strong>期待回答:</strong> ${metadata.groundTruth}<br>
  <strong>エージェント:</strong> ${metadata.agent} | <strong>環境:</strong> ${metadata.environment} | <strong>実行回数:</strong> ${metadata.completedIterations}/${metadata.iterations}<br>
  <strong>所要時間:</strong> ${(metadata.totalDurationMs / 1000).toFixed(1)}s | <strong>トークン:</strong> ${metadata.totalTokens.total.toLocaleString()} (prompt: ${metadata.totalTokens.prompt.toLocaleString()}, completion: ${metadata.totalTokens.completion.toLocaleString()})<br>
  <strong>タイムスタンプ:</strong> ${metadata.timestamp}
</div>

<div class="grid">
  <div class="card">
    <h2>レーダーチャート（平均スコア）</h2>
    <canvas id="radarChart"></canvas>
  </div>
  <div class="card">
    <h2>サマリー</h2>
    <table>
      <thead><tr><th>指標</th><th>平均</th><th>標準偏差</th><th>最小</th><th>最大</th></tr></thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </div>
</div>

<div class="grid">
  ${metricsHtml}
</div>

<div class="card" style="margin-bottom:24px;">
  <h2>時系列スコア</h2>
  <canvas id="timelineChart"></canvas>
</div>

<div class="card">
  <h2>回答一覧</h2>
  ${answersHtml}
</div>

<script>
// Radar Chart
new Chart(document.getElementById('radarChart'), {
  type: 'radar',
  data: {
    labels: ${scoreLabels},
    datasets: [{
      label: '平均スコア',
      data: ${avgValues},
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgb(54, 162, 235)',
      pointBackgroundColor: 'rgb(54, 162, 235)',
    }]
  },
  options: {
    scales: { r: { min: 0, max: 1, ticks: { stepSize: 0.2 } } },
    plugins: { legend: { display: false } }
  }
});

// Timeline Chart
new Chart(document.getElementById('timelineChart'), {
  type: 'line',
  data: {
    labels: ${iterationLabels},
    datasets: ${JSON.stringify(timelineDatasets)}
  },
  options: {
    scales: {
      y: { min: 0, max: 1, title: { display: true, text: 'Score' } },
      x: { title: { display: true, text: 'Iteration' } }
    },
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom' } }
  }
});
</script>

</body>
</html>`;
};

// ─── 比較HTML生成 ──────────────────────────────────────────

const generateCompareHtml = (
  entries: CompareEntry[],
  question: string,
  groundTruth: string,
): string => {
  const scoreLabels = JSON.stringify(SCORE_NAMES);

  const radarDatasets = entries.map(({ env, result }) => ({
    label: ENV_LABELS[env],
    data: SCORE_NAMES.map((n) => result.summary.averageScores[n] ?? 0),
    backgroundColor: ENV_COLORS[env]
      .replace("rgb", "rgba")
      .replace(")", ", 0.15)"),
    borderColor: ENV_COLORS[env],
    pointBackgroundColor: ENV_COLORS[env],
  }));

  const comparisonRows = SCORE_NAMES.map((name) => {
    const cells = entries
      .map(({ result }) => {
        const val = result.summary.averageScores[name];
        return `<td>${val?.toFixed(3) ?? "N/A"}</td>`;
      })
      .join("\n        ");

    const localVal = entries.find((e) => e.env === "local")?.result.summary
      .averageScores[name];
    const prdVal = entries.find((e) => e.env === "production")?.result.summary
      .averageScores[name];
    let improvementHtml = "<td>N/A</td>";
    if (localVal != null && prdVal != null && prdVal !== 0) {
      const isInverse = name === "hallucination";
      const diff = isInverse ? prdVal - localVal : localVal - prdVal;
      const pct = (diff / Math.abs(prdVal)) * 100;
      const sign = pct >= 0 ? "+" : "";
      const color = pct >= 0 ? "#22c55e" : "#ef4444";
      improvementHtml = `<td style="color:${color};font-weight:600;">${sign}${pct.toFixed(1)}%</td>`;
    }

    const desc = SCORE_DESCRIPTIONS[name];
    return `<tr>
        <td><strong>${desc.label}</strong><br><small style="color:#888">${desc.description}</small></td>
        ${cells}
        ${improvementHtml}
      </tr>`;
  }).join("\n");

  const perfRows = entries
    .map(({ env, result }) => {
      const m = result.metadata;
      return `<tr>
        <td>${ENV_LABELS[env]}</td>
        <td>${m.completedIterations}/${m.iterations}</td>
        <td>${(m.totalDurationMs / 1000).toFixed(1)}s</td>
        <td>${m.totalTokens.total.toLocaleString()}</td>
        <td>${m.totalTokens.prompt.toLocaleString()}</td>
        <td>${m.totalTokens.completion.toLocaleString()}</td>
      </tr>`;
    })
    .join("\n");

  const sampleAnswersHtml = entries
    .map(({ env, result }) => {
      const firstSuccess = result.timeline.find((r) => !r.error);
      const answer = firstSuccess?.answer ?? "(回答なし)";
      const escapedAnswer = answer
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
      const scoresText = firstSuccess
        ? SCORE_NAMES.map(
            (n) => `${n}: ${firstSuccess.scores[n]?.toFixed(3) ?? "N/A"}`,
          ).join(" | ")
        : "";
      return `<div class="env-answer">
      <h3>${ENV_LABELS[env]}</h3>
      <p class="scores-line">${scoresText}</p>
      <p>${escapedAnswer}</p>
    </div>`;
    })
    .join("\n");

  const envHeaders = entries
    .map(({ env }) => `<th>${ENV_LABELS[env]}</th>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Eval V2 Compare: ${question}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; padding: 24px; }
  h1 { font-size: 1.4rem; margin-bottom: 8px; }
  .meta { color: #666; font-size: 0.9rem; margin-bottom: 24px; line-height: 1.6; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  .card { background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
  .card h2 { font-size: 1.1rem; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #f8f8f8; font-weight: 600; }
  canvas { max-height: 400px; }
  .env-answer { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .env-answer h3 { font-size: 0.95rem; margin-bottom: 8px; color: #374151; }
  .env-answer .scores-line { font-size: 0.8rem; color: #6b7280; font-family: monospace; margin-bottom: 8px; }
  .env-answer p { font-size: 0.85rem; line-height: 1.6; }
  .legend-item { display: inline-flex; align-items: center; margin-right: 16px; font-size: 0.85rem; }
  .legend-dot { width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; }
</style>
</head>
<body>

<h1>Eval V2 環境比較レポート</h1>
<div class="meta">
  <strong>質問:</strong> ${question}<br>
  <strong>期待回答:</strong> ${groundTruth}<br>
  <strong>環境:</strong>
  <span class="legend-item"><span class="legend-dot" style="background:${ENV_COLORS.local}"></span>local</span>
  <span class="legend-item"><span class="legend-dot" style="background:${ENV_COLORS.development}"></span>dev</span>
  <span class="legend-item"><span class="legend-dot" style="background:${ENV_COLORS.production}"></span>prd</span>
</div>

<div class="grid">
  <div class="card" style="margin-bottom:0;">
    <h2>レーダーチャート（3環境比較）</h2>
    <canvas id="radarChart"></canvas>
  </div>
  <div class="card" style="margin-bottom:0;">
    <h2>スコア比較</h2>
    <table>
      <thead><tr><th>指標</th>${envHeaders}<th>改善率<br><small>(prd→local)</small></th></tr></thead>
      <tbody>${comparisonRows}</tbody>
    </table>
  </div>
</div>

<div class="card">
  <h2>性能比較</h2>
  <table>
    <thead><tr><th>環境</th><th>完了</th><th>所要時間</th><th>総トークン</th><th>Prompt</th><th>Completion</th></tr></thead>
    <tbody>${perfRows}</tbody>
  </table>
</div>

<div class="card">
  <h2>回答サンプル（各環境の初回成功回答）</h2>
  ${sampleAnswersHtml}
</div>

<script>
new Chart(document.getElementById('radarChart'), {
  type: 'radar',
  data: {
    labels: ${scoreLabels},
    datasets: ${JSON.stringify(radarDatasets)}
  },
  options: {
    scales: { r: { min: 0, max: 1, ticks: { stepSize: 0.2 } } },
    plugins: { legend: { position: 'bottom' } }
  }
});
</script>

</body>
</html>`;
};

// ─── 複数テストケース統合比較HTML生成 ────────────────────────

const generateMultiCaseCompareHtml = (
  allResults: MultiCaseCompareEntry[],
  n: number,
  agentName: string,
): string => {
  // 環境ごとの全体平均を算出
  const envScoreValues: Record<EnvName, Record<ScoreName, number[]>> = {
    local: {
      similarity: [],
      faithfulness: [],
      contextPrecision: [],
      contextRelevance: [],
      hallucination: [],
    },
    development: {
      similarity: [],
      faithfulness: [],
      contextPrecision: [],
      contextRelevance: [],
      hallucination: [],
    },
    production: {
      similarity: [],
      faithfulness: [],
      contextPrecision: [],
      contextRelevance: [],
      hallucination: [],
    },
  };

  for (const { entries } of allResults) {
    for (const { env, result } of entries) {
      for (const name of SCORE_NAMES) {
        const val = result.summary.averageScores[name];
        if (val !== null) {
          envScoreValues[env][name].push(val);
        }
      }
    }
  }

  const overallAvg = {} as Record<EnvName, Record<ScoreName, number | null>>;
  for (const env of ENV_NAMES) {
    overallAvg[env] = {} as Record<ScoreName, number | null>;
    for (const name of SCORE_NAMES) {
      const vals = envScoreValues[env][name];
      overallAvg[env][name] =
        vals.length > 0
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 1000) /
            1000
          : null;
    }
  }

  // レーダーチャートデータ
  const scoreLabels = JSON.stringify(SCORE_NAMES);
  const radarDatasets = ENV_NAMES.map((env) => ({
    label: ENV_LABELS[env],
    data: SCORE_NAMES.map((name) => overallAvg[env][name] ?? 0),
    backgroundColor: ENV_COLORS[env]
      .replace("rgb", "rgba")
      .replace(")", ", 0.15)"),
    borderColor: ENV_COLORS[env],
    pointBackgroundColor: ENV_COLORS[env],
  }));

  // 全体平均テーブル
  const envHeaders = ENV_NAMES.map((env) => `<th>${ENV_LABELS[env]}</th>`).join(
    "",
  );

  const overallRows = SCORE_NAMES.map((name) => {
    const cells = ENV_NAMES.map((env) => {
      const val = overallAvg[env][name];
      return `<td>${val?.toFixed(3) ?? "N/A"}</td>`;
    }).join("");

    const localVal = overallAvg.local[name];
    const prdVal = overallAvg.production[name];
    let improvementHtml = "<td>N/A</td>";
    if (localVal != null && prdVal != null && prdVal !== 0) {
      const isInverse = name === "hallucination";
      const diff = isInverse ? prdVal - localVal : localVal - prdVal;
      const pct = (diff / Math.abs(prdVal)) * 100;
      const sign = pct >= 0 ? "+" : "";
      const color = pct >= 0 ? "#22c55e" : "#ef4444";
      improvementHtml = `<td style="color:${color};font-weight:600;">${sign}${pct.toFixed(1)}%</td>`;
    }

    const desc = SCORE_DESCRIPTIONS[name];
    return `<tr><td><strong>${desc.label}</strong><br><small style="color:#888">${desc.description}</small></td>${cells}${improvementHtml}</tr>`;
  }).join("\n");

  // ヒートマップ色
  const heatmapColor = (value: number | null, inverse = false): string => {
    if (value === null) return "#f3f4f6";
    const v = inverse ? 1 - value : value;
    const hue = Math.round(v * 120);
    return `hsl(${hue}, 70%, 85%)`;
  };

  // テストケース別ヒートマップ（主要指標）
  const keyMetrics: ScoreName[] = [
    "similarity",
    "faithfulness",
    "hallucination",
  ];
  const heatmapHeaderRow = keyMetrics
    .map((m) => `<th colspan="3">${m}</th>`)
    .join("");
  const heatmapSubHeader = keyMetrics
    .map(() => ENV_NAMES.map((env) => `<th>${ENV_LABELS[env]}</th>`).join(""))
    .join("");

  const heatmapRows = allResults
    .map(({ testCase, entries }) => {
      const questionSlug =
        testCase.input.length > 30
          ? `${testCase.input.slice(0, 30)}…`
          : testCase.input;

      const cells = keyMetrics
        .map((metric) => {
          return ENV_NAMES.map((env) => {
            const entry = entries.find((e) => e.env === env);
            const val = entry?.result.summary.averageScores[metric] ?? null;
            const isInverse = metric === "hallucination";
            const bg = heatmapColor(val, isInverse);
            return `<td style="background:${bg};text-align:center;">${val?.toFixed(3) ?? "N/A"}</td>`;
          }).join("");
        })
        .join("");

      return `<tr><td title="${testCase.input.replace(/"/g, "&quot;")}">${questionSlug}</td>${cells}</tr>`;
    })
    .join("\n");

  // 性能比較
  const perfRows = ENV_NAMES.map((envName) => {
    let totalCompleted = 0;
    let totalIterations = 0;
    let totalDuration = 0;
    let totalTokens = 0;
    let totalAbstention = 0;

    for (const { entries } of allResults) {
      const entry = entries.find((e) => e.env === envName);
      if (entry) {
        totalCompleted += entry.result.metadata.completedIterations;
        totalIterations += entry.result.metadata.iterations;
        totalDuration += entry.result.metadata.totalDurationMs;
        totalTokens += entry.result.metadata.totalTokens.total;
        totalAbstention += entry.result.summary.metrics.abstentionCount;
      }
    }

    return `<tr>
      <td>${ENV_LABELS[envName]}</td>
      <td>${totalCompleted}/${totalIterations}</td>
      <td>${(totalDuration / 1000).toFixed(1)}s</td>
      <td>${totalTokens.toLocaleString()}</td>
      <td>${totalAbstention}</td>
    </tr>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Eval V2 Compare Summary: ${allResults.length} cases</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; padding: 24px; }
  h1 { font-size: 1.4rem; margin-bottom: 8px; }
  .meta { color: #666; font-size: 0.9rem; margin-bottom: 24px; line-height: 1.6; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  .card { background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
  .card h2 { font-size: 1.1rem; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #f8f8f8; font-weight: 600; }
  canvas { max-height: 400px; }
  .legend-item { display: inline-flex; align-items: center; margin-right: 16px; font-size: 0.85rem; }
  .legend-dot { width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; }
  .heatmap td { font-family: monospace; font-size: 0.8rem; }
</style>
</head>
<body>

<h1>Eval V2 環境比較サマリー</h1>
<div class="meta">
  <strong>テストケース:</strong> ${allResults.length}件 |
  <strong>エージェント:</strong> ${agentName} |
  <strong>各N回:</strong> ${n}<br>
  <strong>環境:</strong>
  <span class="legend-item"><span class="legend-dot" style="background:${ENV_COLORS.local}"></span>local</span>
  <span class="legend-item"><span class="legend-dot" style="background:${ENV_COLORS.development}"></span>dev</span>
  <span class="legend-item"><span class="legend-dot" style="background:${ENV_COLORS.production}"></span>prd</span>
</div>

<div class="grid">
  <div class="card" style="margin-bottom:0;">
    <h2>全体平均スコア（3環境比較）</h2>
    <canvas id="radarChart"></canvas>
  </div>
  <div class="card" style="margin-bottom:0;">
    <h2>全体平均スコア</h2>
    <table>
      <thead><tr><th>指標</th>${envHeaders}<th>改善率<br><small>(prd→local)</small></th></tr></thead>
      <tbody>${overallRows}</tbody>
    </table>
  </div>
</div>

<div class="card">
  <h2>テストケース別スコア（ヒートマップ）</h2>
  <div style="overflow-x:auto;">
    <table class="heatmap">
      <thead>
        <tr><th rowspan="2">質問</th>${heatmapHeaderRow}</tr>
        <tr>${heatmapSubHeader}</tr>
      </thead>
      <tbody>${heatmapRows}</tbody>
    </table>
  </div>
</div>

<div class="card">
  <h2>性能比較（合計）</h2>
  <table>
    <thead><tr><th>環境</th><th>完了</th><th>所要時間</th><th>総トークン</th><th>Abstention</th></tr></thead>
    <tbody>${perfRows}</tbody>
  </table>
</div>

<script>
new Chart(document.getElementById('radarChart'), {
  type: 'radar',
  data: {
    labels: ${scoreLabels},
    datasets: ${JSON.stringify(radarDatasets)}
  },
  options: {
    scales: { r: { min: 0, max: 1, ticks: { stepSize: 0.2 } } },
    plugins: { legend: { position: 'bottom' } }
  }
});
</script>

</body>
</html>`;
};

// ─── テストケース実行 ────────────────────────────────────────

const runTestCaseEval = async (params: {
  testCase: TestCase;
  agent: typeof knowledgeAgent;
  requestContext: RequestContext;
  n: number;
  agentName: string;
  envName: EnvName;
}): Promise<EvalResult> => {
  const { testCase, agent, requestContext, n, agentName, envName } = params;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📝 質問: ${testCase.input}`);
  console.log(`📋 期待: ${testCase.groundTruth}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const timeline: IterationResult[] = [];
  const totalStart = Date.now();

  for (let i = 0; i < n; i++) {
    const iterStart = Date.now();
    const iterNum = i + 1;

    try {
      process.stdout.write(`  [${iterNum}/${n}] 生成中...`);

      const result = await agent.generate(testCase.input, {
        requestContext,
        maxSteps: 3,
      });

      // biome-ignore lint/suspicious/noExplicitAny: agent.generate の戻り値型は不定
      const steps = (result as any).steps;

      const retrievedChunks = extractKnowledgeSearchResults(steps);
      const context = retrievedChunks.map((c) => c.content);

      const transcript = extractTranscript(steps);

      const abstention = isAbstention(result.text);

      process.stdout.write(" スコアリング中...");

      const scores = await runEvalScorers({
        input: testCase.input,
        output: result.text,
        groundTruth: testCase.groundTruth,
        context,
        abstention,
      });

      const durationMs = Date.now() - iterStart;
      // biome-ignore lint/suspicious/noExplicitAny: usage の型は不定
      const rawUsage = (result as any).usage;
      const usage: TokenUsage | null = rawUsage
        ? {
            promptTokens: rawUsage.promptTokens ?? 0,
            completionTokens: rawUsage.completionTokens ?? 0,
            totalTokens:
              (rawUsage.totalTokens ?? 0) ||
              (rawUsage.promptTokens ?? 0) + (rawUsage.completionTokens ?? 0),
          }
        : null;

      const stepCount = transcript.length;
      const toolCallCount = transcript.reduce(
        (sum, s) => sum + s.toolCalls.length,
        0,
      );
      const hasAnswer = result.text.trim().length > 0;

      timeline.push({
        iteration: iterNum,
        answer: result.text,
        scores,
        durationMs,
        usage,
        error: null,
        transcript,
        stepCount,
        toolCallCount,
        hasAnswer,
        isAbstention: abstention,
      });

      const simScore = scores.similarity?.toFixed(3) ?? "N/A";
      const tokenInfo = usage ? ` tok=${usage.totalTokens}` : "";
      const abstentionIcon = abstention ? " [abstention]" : "";
      console.log(
        ` ✅ (${durationMs}ms) sim=${simScore} steps=${stepCount} tools=${toolCallCount}${abstentionIcon}${tokenInfo}`,
      );
    } catch (e) {
      const durationMs = Date.now() - iterStart;
      const errorMsg = (e as Error).message;
      timeline.push({
        iteration: iterNum,
        answer: "",
        scores: {
          similarity: null,
          faithfulness: null,
          contextPrecision: null,
          contextRelevance: null,
          hallucination: null,
        },
        durationMs,
        usage: null,
        error: errorMsg,
        transcript: [],
        stepCount: 0,
        toolCallCount: 0,
        hasAnswer: false,
        isAbstention: true,
      });
      console.log(` ❌ (${durationMs}ms) ${errorMsg}`);
    }

    // イテレーション間インターバル（最後のイテレーション以外）
    if (i < n - 1) {
      await sleep(2000);
    }
  }

  const totalDurationMs = Date.now() - totalStart;
  const summary = calcStats(timeline);
  const timestamp = new Date().toISOString();

  const totalTokens = timeline.reduce(
    (acc, r) => {
      if (r.usage) {
        acc.prompt += r.usage.promptTokens;
        acc.completion += r.usage.completionTokens;
        acc.total += r.usage.totalTokens;
      }
      return acc;
    },
    { prompt: 0, completion: 0, total: 0 },
  );

  return {
    metadata: {
      question: testCase.input,
      groundTruth: testCase.groundTruth,
      agent: agentName,
      environment: envName,
      iterations: n,
      completedIterations: timeline.filter((r) => !r.error).length,
      timestamp,
      totalDurationMs,
      totalTokens,
    },
    summary,
    timeline,
  };
};

// ─── メイン ───────────────────────────────────────────────

const main = async () => {
  const args = parseArgs();

  // テストケースの解決
  let testCases: TestCase[];

  if (args.question && args.truth) {
    testCases = [{ input: args.question, groundTruth: args.truth }];
  } else if (args.caseIndex !== undefined) {
    const tc = evalV2TestCases[args.caseIndex];
    if (!tc) {
      console.error(
        `❌ テストケース #${args.caseIndex} が見つかりません（0-${evalV2TestCases.length - 1}）`,
      );
      process.exit(1);
    }
    testCases = [tc];
  } else if (args.category) {
    testCases = evalTestCases
      .filter((c) => c.category === args.category)
      .map(({ input, groundTruth }) => ({ input, groundTruth }));
    if (testCases.length === 0) {
      console.error(
        `❌ カテゴリ "${args.category}" のテストケースが見つかりません`,
      );
      process.exit(1);
    }
  } else {
    testCases = evalV2TestCases;
  }

  console.log("🔄 Eval V2 開始");
  console.log(`   エージェント: ${args.agent}`);
  console.log(`   テストケース数: ${testCases.length}`);
  console.log(`   各N回: ${args.n}`);
  console.log(
    `   環境: ${args.compare ? "3環境比較 (local → dev → prd)" : args.env}`,
  );
  if (testCases.length > 1 && args.interval > 0) {
    console.log(`   インターバル: ${args.interval}秒（テストケース間）`);
  }
  console.log();

  // LibSQLStore 作成
  const libsqlStore = new LibSQLStore({
    id: "mastra-storage",
    url: "file:mastra.db",
  });

  // エージェント選択
  const agentMap: Record<string, ReturnType<typeof createNeppChanAgent>> = {
    knowledge: knowledgeAgent,
    "nepp-chan": createNeppChanAgent({
      isAdmin: false,
      memory: () =>
        new Memory({
          storage: libsqlStore,
          options: { lastMessages: 5 },
        }),
    }),
  };

  const agent = agentMap[args.agent];
  if (!agent) {
    console.error(`❌ 不明なエージェント: ${args.agent}`);
    process.exit(1);
  }

  // ─── クォータ事前チェック ──────────────────────────────────
  const envCount = args.compare ? 3 : 1;
  const estimatedGeminiCalls = testCases.length * args.n * 3 * envCount; // ~3 steps/case
  const estimatedScorerCalls = testCases.length * args.n * 4 * envCount; // 4 scorers/case
  const GEMINI_RPD = 10_000;
  const OPENAI_RPM = 500;
  const estimatedDurationMin = Math.ceil(
    (testCases.length * args.n * 70 * envCount) / 60,
  ); // ~70s/iteration

  console.log("─── クォータ事前チェック ─────────────────────────");
  console.log(
    `   Gemini 推定リクエスト数: ${estimatedGeminiCalls.toLocaleString()} / ${GEMINI_RPD.toLocaleString()} RPD (${((estimatedGeminiCalls / GEMINI_RPD) * 100).toFixed(0)}%)`,
  );
  console.log(
    `   OpenAI 推定リクエスト数: ${estimatedScorerCalls.toLocaleString()} (RPM ${OPENAI_RPM})`,
  );
  console.log(`   推定実行時間: ${estimatedDurationMin}分`);

  if (estimatedGeminiCalls > GEMINI_RPD * 0.8) {
    console.warn(
      `\n⚠️  警告: Gemini RPD の ${((estimatedGeminiCalls / GEMINI_RPD) * 100).toFixed(0)}% を消費する見込みです`,
    );
    console.warn(
      "   同じ GCP プロジェクトの他サービス（prd 等）に影響する可能性があります",
    );
    if (estimatedGeminiCalls > GEMINI_RPD) {
      console.error(
        "\n❌ エラー: Gemini RPD を超過します。テストケース数または n を減らしてください",
      );
      console.error(
        `   推奨: n=${Math.floor((GEMINI_RPD * 0.8) / (testCases.length * 3 * envCount))} 以下`,
      );
      process.exit(1);
    }
  }
  console.log("─────────────────────────────────────────────────\n");

  // 出力ディレクトリ
  const outputDir = path.resolve(
    import.meta.dirname,
    "../../dataset/eval/results",
  );
  fs.mkdirSync(outputDir, { recursive: true });

  if (args.compare) {
    // ─── 3環境比較モード ───────────────────────────────────
    const allResults: MultiCaseCompareEntry[] = testCases.map((tc) => ({
      testCase: tc,
      entries: [],
    }));

    for (const envName of ENV_NAMES) {
      console.log(`\n🌐 環境: ${envName} (${ENV_LABELS[envName]})`);

      const { env, dispose } = await getPlatformProxy<CloudflareBindings>({
        configPath: "wrangler.jsonc",
        environment: envName,
        remoteBindings: true,
      });
      resolveEvalApiKeys(env);

      const requestContext = new RequestContext();
      requestContext.set("env", env);

      for (let tcIdx = 0; tcIdx < testCases.length; tcIdx++) {
        const testCase = testCases[tcIdx];
        if (testCases.length > 1) {
          console.log(
            `\n  📝 [${tcIdx + 1}/${testCases.length}] ${testCase.input}`,
          );
        }

        const result = await runTestCaseEval({
          testCase,
          agent,
          requestContext,
          n: args.n,
          agentName: args.agent,
          envName,
        });

        // 個別結果の保存
        const envLabel = ENV_LABELS[envName];
        const prefix = generateFilePrefix(
          envLabel,
          args.agent,
          testCase.input,
          args.n,
        );
        const jsonPath = path.join(outputDir, `${prefix}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
        console.log(`  📁 JSON: ${jsonPath}`);

        // サマリー表示
        console.log(`  📊 ${envLabel} 結果サマリー:`);
        for (const name of SCORE_NAMES) {
          const avg = result.summary.averageScores[name];
          const sd = result.summary.stdDev[name];
          if (avg !== null) {
            console.log(`     ${name}: ${avg.toFixed(3)} (±${sd?.toFixed(3)})`);
          }
        }
        const m = result.summary.metrics;
        console.log(
          `     📏 steps=${m.avgStepCount} tools=${m.avgToolCallCount} abstention=${m.abstentionCount}(${(m.abstentionRate * 100).toFixed(1)}%)`,
        );

        allResults[tcIdx].entries.push({ env: envName, result });

        // テストケース間のインターバル（最後のケース以外）
        if (args.interval > 0 && tcIdx < testCases.length - 1) {
          console.log(`  ⏳ ${args.interval}秒インターバル...`);
          await sleep(args.interval * 1000);
        }
      }

      await dispose();
    }

    // 各テストケースの比較HTMLを生成
    for (const { testCase, entries } of allResults) {
      const comparePrefix = generateFilePrefix(
        "compare",
        args.agent,
        testCase.input,
        args.n,
      );
      const compareHtmlPath = path.join(outputDir, `${comparePrefix}.html`);
      fs.writeFileSync(
        compareHtmlPath,
        generateCompareHtml(entries, testCase.input, testCase.groundTruth),
      );
      console.log(`📊 比較レポート: ${compareHtmlPath}`);
    }

    // 複数テストケースの場合、統合サマリーHTMLも生成
    if (allResults.length > 1) {
      const summarySlug = args.category ?? `${testCases.length}cases`;
      const summaryPrefix = generateFilePrefix(
        "compare-summary",
        args.agent,
        summarySlug,
        args.n,
      );
      const summaryHtmlPath = path.join(outputDir, `${summaryPrefix}.html`);
      fs.writeFileSync(
        summaryHtmlPath,
        generateMultiCaseCompareHtml(allResults, args.n, args.agent),
      );
      console.log(`📊 統合サマリー: ${summaryHtmlPath}`);
    }
  } else {
    // ─── 単一環境モード ────────────────────────────────────

    // Vectorize リモートバインディングのセッション安定性対策:
    // getPlatformProxy のセッションは長時間稼働でトークン期限切れが発生するため、
    // SESSION_RECREATE_INTERVAL 件ごとにセッションを再作成する
    // 注意: セッション再作成は Cloudflare 認証トークンの期限切れで失敗する場合がある。
    // その場合は値を 999 にして無効化し、1セッションで走り切らせる。
    // ただし 1セッションで ~50件超えると VECTOR_QUERY_ERROR が発生する可能性もある。
    const SESSION_RECREATE_INTERVAL = 999;

    let currentDispose: () => Promise<void>;
    let requestContext: RequestContext;

    const createSession = async () => {
      const proxy = await getPlatformProxy<CloudflareBindings>({
        configPath: "wrangler.jsonc",
        environment: args.env,
        remoteBindings: true,
      });
      resolveEvalApiKeys(proxy.env);
      requestContext = new RequestContext();
      requestContext.set("env", proxy.env);
      currentDispose = proxy.dispose;
    };

    await createSession();

    for (let tcIdx = 0; tcIdx < testCases.length; tcIdx++) {
      // N件ごとにセッション再作成（Vectorize セッション劣化対策）
      if (tcIdx > 0 && tcIdx % SESSION_RECREATE_INTERVAL === 0) {
        console.log(`\n🔄 セッション再作成 (${tcIdx}/${testCases.length}件目)`);
        await currentDispose();
        await sleep(2000);
        await createSession();
      }

      const testCase = testCases[tcIdx];
      const result = await runTestCaseEval({
        testCase,
        agent,
        requestContext,
        n: args.n,
        agentName: args.agent,
        envName: args.env,
      });

      const envLabel = ENV_LABELS[args.env];
      const prefix = generateFilePrefix(
        envLabel,
        args.agent,
        testCase.input,
        args.n,
      );
      const jsonPath = path.join(outputDir, `${prefix}.json`);
      const htmlPath = path.join(outputDir, `${prefix}.html`);

      fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
      fs.writeFileSync(htmlPath, generateHtml(result));

      console.log(`\n📊 結果サマリー:`);
      for (const name of SCORE_NAMES) {
        const avg = result.summary.averageScores[name];
        const sd = result.summary.stdDev[name];
        if (avg !== null) {
          console.log(`   ${name}: ${avg.toFixed(3)} (±${sd?.toFixed(3)})`);
        }
      }
      const m = result.summary.metrics;
      console.log(
        `   📏 steps=${m.avgStepCount} tools=${m.avgToolCallCount} abstention=${m.abstentionCount}(${(m.abstentionRate * 100).toFixed(1)}%)`,
      );
      console.log(
        `\n🪙 トークン消費: ${result.metadata.totalTokens.total.toLocaleString()} (prompt: ${result.metadata.totalTokens.prompt.toLocaleString()}, completion: ${result.metadata.totalTokens.completion.toLocaleString()})`,
      );
      console.log(`\n📁 JSON: ${jsonPath}`);
      console.log(`📁 HTML: ${htmlPath}\n`);

      // テストケース間のインターバル（最後のケース以外）
      if (args.interval > 0 && tcIdx < testCases.length - 1) {
        console.log(`⏳ ${args.interval}秒インターバル...`);
        await sleep(args.interval * 1000);
      }
    }

    await currentDispose();
  }

  console.log("✅ Eval V2 完了");
};

main().catch((error) => {
  console.error("❌ エラーが発生しました:", error);
  process.exit(1);
});
