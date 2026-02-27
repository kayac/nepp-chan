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
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { RequestContext } from "@mastra/core/request-context";
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
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { getPlatformProxy } from "wrangler";

import { GEMINI_FLASH_LITE } from "../src/lib/llm-models";
import { knowledgeAgent } from "../src/mastra/agents/knowledge-agent";
import { createNeppChanAgent } from "../src/mastra/agents/nepp-chan-agent";
import type { TestCase } from "../src/mastra/data/eval-test-cases";
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

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface IterationResult {
  iteration: number;
  answer: string;
  scores: Scores;
  durationMs: number;
  usage: TokenUsage | null;
  error: string | null;
}

interface EvalResult {
  metadata: {
    question: string;
    groundTruth: string;
    agent: string;
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
  };
  timeline: IterationResult[];
}

interface CliArgs {
  question?: string;
  truth?: string;
  n: number;
  agent: "knowledge" | "nepp-chan";
  caseIndex?: number;
}

// ─── CLI引数パース ────────────────────────────────────────

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const result: CliArgs = { n: 100, agent: "knowledge" };

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

// ─── スコアラー実行 ───────────────────────────────────────

const runEvalScorers = async ({
  input,
  output,
  groundTruth,
  context,
}: {
  input: string;
  output: string;
  groundTruth: string;
  context: string[];
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
      model: GEMINI_FLASH_LITE,
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

  // 残りのスコアラーを直列実行
  try {
    const result = await createFaithfulnessScorer({
      model: GEMINI_FLASH_LITE,
      options: { context },
    }).run({
      input: testRun.input,
      output: testRun.output,
    });
    scores.faithfulness = result?.score ?? null;
  } catch (e) {
    console.warn("  ⚠ faithfulness scorer failed:", (e as Error).message);
  }

  try {
    const result = await createContextPrecisionScorer({
      model: GEMINI_FLASH_LITE,
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

  try {
    const result = await createContextRelevanceScorerLLM({
      model: GEMINI_FLASH_LITE,
      options: { context },
    }).run({
      input: testRun.input,
      output: testRun.output,
    });
    scores.contextRelevance = result?.score ?? null;
  } catch (e) {
    console.warn("  ⚠ contextRelevance scorer failed:", (e as Error).message);
  }

  try {
    const result = await createHallucinationScorer({
      model: GEMINI_FLASH_LITE,
      options: { context },
    }).run({
      input: testRun.input,
      output: testRun.output,
    });
    scores.hallucination = result?.score ?? null;
  } catch (e) {
    console.warn("  ⚠ hallucination scorer failed:", (e as Error).message);
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

  return { averageScores: avg, stdDev, min, max };
};

// ─── ファイル名生成 ───────────────────────────────────────

const generateFilePrefix = (
  agent: string,
  question: string,
  n: number,
): string => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const slug = question.slice(0, 10).replace(/[?？\s/\\]/g, "");
  return `${date}_${time}_${agent}_${slug}_n${n}`;
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
      const escapedAnswer = r.answer
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
      const errorHtml = r.error
        ? `<p style="color:red;">Error: ${r.error}</p>`
        : "";
      return `<details>
  <summary>#${r.iteration} (${r.durationMs}ms) — ${scoresText}</summary>
  <div class="answer-detail">
    ${errorHtml}
    <p>${escapedAnswer}</p>
  </div>
</details>`;
    })
    .join("\n");

  // サマリーテーブル行
  const summaryRows = SCORE_NAMES.map(
    (name) =>
      `<tr>
        <td>${name}</td>
        <td>${summary.averageScores[name]?.toFixed(3) ?? "N/A"}</td>
        <td>${summary.stdDev[name]?.toFixed(3) ?? "N/A"}</td>
        <td>${summary.min[name]?.toFixed(3) ?? "N/A"}</td>
        <td>${summary.max[name]?.toFixed(3) ?? "N/A"}</td>
      </tr>`,
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Eval V2: ${metadata.question}</title>
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
  <strong>エージェント:</strong> ${metadata.agent} | <strong>実行回数:</strong> ${metadata.completedIterations}/${metadata.iterations}<br>
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
  } else {
    testCases = evalV2TestCases;
  }

  console.log(`🔄 Eval V2 開始`);
  console.log(`   エージェント: ${args.agent}`);
  console.log(`   テストケース数: ${testCases.length}`);
  console.log(`   各N回: ${args.n}\n`);

  // Cloudflare バインディング取得（local env の Vectorize/R2 にリモート接続）
  const { env, dispose } = await getPlatformProxy<CloudflareBindings>({
    configPath: "wrangler.jsonc",
    environment: "local",
    remoteBindings: true,
  });

  // AI SDK が process.env から API キーを参照するため明示的に設定
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = env.GOOGLE_GENERATIVE_AI_API_KEY;

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

  const requestContext = new RequestContext();
  requestContext.set("env", env);

  // 出力ディレクトリ
  const outputDir = path.resolve(
    import.meta.dirname,
    "../../dataset/eval/results",
  );
  fs.mkdirSync(outputDir, { recursive: true });

  // テストケースごとに実行
  for (const testCase of testCases) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📝 質問: ${testCase.input}`);
    console.log(`📋 期待: ${testCase.groundTruth}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const timeline: IterationResult[] = [];
    const totalStart = Date.now();

    for (let i = 0; i < args.n; i++) {
      const iterStart = Date.now();
      const iterNum = i + 1;

      try {
        process.stdout.write(`  [${iterNum}/${args.n}] 生成中...`);

        const result = await agent.generate(testCase.input, {
          requestContext,
        });

        const retrievedChunks = extractKnowledgeSearchResults(
          // biome-ignore lint/suspicious/noExplicitAny: agent.generate の戻り値型は不定
          (result as any).steps,
        );
        const context = retrievedChunks.map((c) => c.content);

        process.stdout.write(" スコアリング中...");

        const scores = await runEvalScorers({
          input: testCase.input,
          output: result.text,
          groundTruth: testCase.groundTruth,
          context,
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
                (rawUsage.promptTokens ?? 0) +
                  (rawUsage.completionTokens ?? 0),
            }
          : null;

        timeline.push({
          iteration: iterNum,
          answer: result.text,
          scores,
          durationMs,
          usage,
          error: null,
        });

        const simScore = scores.similarity?.toFixed(3) ?? "N/A";
        const tokenInfo = usage ? ` tok=${usage.totalTokens}` : "";
        console.log(` ✅ (${durationMs}ms) sim=${simScore}${tokenInfo}`);
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
        });
        console.log(` ❌ (${durationMs}ms) ${errorMsg}`);
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

    const evalResult: EvalResult = {
      metadata: {
        question: testCase.input,
        groundTruth: testCase.groundTruth,
        agent: args.agent,
        iterations: args.n,
        completedIterations: timeline.filter((r) => !r.error).length,
        timestamp,
        totalDurationMs,
        totalTokens,
      },
      summary,
      timeline,
    };

    // ファイル出力
    const prefix = generateFilePrefix(args.agent, testCase.input, args.n);
    const jsonPath = path.join(outputDir, `${prefix}.json`);
    const htmlPath = path.join(outputDir, `${prefix}.html`);

    fs.writeFileSync(jsonPath, JSON.stringify(evalResult, null, 2));
    fs.writeFileSync(htmlPath, generateHtml(evalResult));

    console.log(`\n📊 結果サマリー:`);
    for (const name of SCORE_NAMES) {
      const avg = summary.averageScores[name];
      const sd = summary.stdDev[name];
      if (avg !== null) {
        console.log(`   ${name}: ${avg.toFixed(3)} (±${sd?.toFixed(3)})`);
      }
    }
    console.log(
      `\n🪙 トークン消費: ${totalTokens.total.toLocaleString()} (prompt: ${totalTokens.prompt.toLocaleString()}, completion: ${totalTokens.completion.toLocaleString()})`,
    );
    console.log(`\n📁 JSON: ${jsonPath}`);
    console.log(`📁 HTML: ${htmlPath}\n`);
  }

  console.log("✅ Eval V2 完了");
  await dispose();
};

main().catch((error) => {
  console.error("❌ エラーが発生しました:", error);
  process.exit(1);
});
