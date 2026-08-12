#!/usr/bin/env tsx
/**
 * Eval V3: Code-based Grader + pass@k/pass^k + Transcript + 全体サマリー
 *
 * V2 からの改善:
 *   - Code-based grader（requiredKeywords チェック）
 *   - pass@k / pass^k メトリクス
 *   - Transcript（中間ステップ）の記録
 *   - テストケースのカテゴリ化 + pass/fail 判定
 *   - 全体サマリー HTML レポート
 *
 * 使用方法:
 *   pnpm eval:v3                                         # 全テストケース × 各5回
 *   pnpm eval:v3 -- --case-id vo-01 --n 3                # ID指定
 *   pnpm eval:v3 -- --category education --n 3            # カテゴリフィルタ
 *   pnpm eval:v3 -- --question "..." --truth "..." --n 3  # アドホック質問
 *   pnpm eval:v3 -- --env development --n 3               # 環境指定
 *   pnpm eval:v3 -- --compare --case-id vo-01 --n 3       # 環境比較
 *   pnpm eval:v3 -- --interval 10 --n 3                  # テストケース間に10秒インターバル
 */

import { execSync } from "node:child_process";
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
import { OPENAI_SCORER, resolveModelTier } from "../src/lib/llm-models";
import { knowledgeAgent } from "../src/mastra/agents/knowledge-agent";
import { createNeppChanAgent } from "../src/mastra/agents/nepp-chan-agent";
import type {
  TestCaseV3,
  TestCategory,
  TestType,
} from "./data/eval-v3-test-cases";
import { evalV3TestCases } from "./data/eval-v3-test-cases";

// ─── Types ───────────────────────────────────────────────

const SCORE_NAMES = [
  "similarity",
  "faithfulness",
  "contextPrecision",
  "contextRelevance",
  "hallucination",
] as const;

const SCORE_DESCRIPTIONS: Record<(typeof SCORE_NAMES)[number], string> = {
  similarity: "期待回答との意味的な類似度",
  faithfulness: "検索結果に忠実に回答しているか",
  contextPrecision: "検索結果の上位に正解が含まれているか",
  contextRelevance: "検索結果が質問に関連しているか",
  hallucination: "検索結果にない情報を生成していないか（低いほど良い）",
};
type ScoreName = (typeof SCORE_NAMES)[number];
type Scores = Record<ScoreName, number | null>;

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

interface KeywordCheckResult {
  pass: boolean;
  matchedKeywords: string[];
  missingKeywords: string[];
  score: number;
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

interface UrlValidationResult {
  /** 回答に含まれるURL一覧 */
  urls: string[];
  /** HTTP HEAD で 200 を返したURL */
  accessibleUrls: string[];
  /** HTTP HEAD で 200 以外だったURL（ステータスコード付き） */
  inaccessibleUrls: { url: string; status: number | "error" }[];
  /** 期待URLとの一致 */
  expectedUrlMatch: boolean | null;
  /** 許可ドメインのURL数 / 全URL数 */
  domainValidRate: number | null;
  /** HTTP 200 率 (accessibleUrls.length / urls.length) */
  accessibleRate: number | null;
}

interface IterationResult {
  iteration: number;
  answer: string;
  scores: Scores;
  keywordCheck: KeywordCheckResult;
  urlValidation: UrlValidationResult | null;
  pass: boolean;
  durationMs: number;
  usage: TokenUsage | null;
  error: string | null;
  transcript: TranscriptStep[];
}

interface PassMetrics {
  passCount: number;
  failCount: number;
  abstentionCount: number;
  passRate: number;
  keywordPassRate: number;
  passAtK: { k1: number; k3: number; k5: number };
  passHatK: { k1: number; k3: number; k5: number };
}

interface EvalResult {
  metadata: {
    testCaseId: string;
    category: TestCategory;
    testType: TestType;
    question: string;
    groundTruth: string;
    requiredKeywords: string[];
    threshold: number;
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
  } & PassMetrics;
  timeline: IterationResult[];
}

interface CompareEntry {
  env: EnvName;
  result: EvalResult;
}

interface OverallSummary {
  totalTestCases: number;
  passedTestCases: number;
  failedTestCases: number;
  overallPassRate: number;
  byCategory: Record<
    string,
    {
      count: number;
      passedCount: number;
      avgSimilarity: number;
      avgPassRate: number;
    }
  >;
  byType: {
    positive: { count: number; passedCount: number; avgPassRate: number };
    negative: { count: number; passedCount: number; avgPassRate: number };
  };
  passAtK: { k1: number; k3: number; k5: number };
  passHatK: { k1: number; k3: number; k5: number };
}

interface CliArgs {
  question?: string;
  truth?: string;
  n: number;
  agent: "knowledge" | "nepp-chan";
  caseIndex?: number;
  caseId?: string;
  category?: TestCategory;
  env: EnvName;
  compare: boolean;
  /** テストケース間のインターバル（秒）。デフォルト5秒 */
  interval: number;
  /** バッチサイズ（指定時はプロセス分割モード） */
  batchSize?: number;
  /** テストケース開始インデックス（子プロセス用） */
  from?: number;
  /** テストケース終了インデックス（子プロセス用） */
  to?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Eval用APIキー解決 ───────────────────────────────────

const resolveEvalApiKeys = (env: CloudflareBindings): void => {
  // biome-ignore lint/suspicious/noExplicitAny: .dev.vars の追加キーは CloudflareBindings に未定義
  const evalGoogleKey = (env as any).EVAL_GOOGLE_API_KEY as string | undefined;
  const googleKey = evalGoogleKey || env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (evalGoogleKey) {
    console.log("🔑 Eval専用Google APIキーを使用");
  }
  // process.env: Mastra の agent.generate() が参照
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = googleKey;
  // env: knowledgeSearchTool → searchKnowledge() が参照（embed + rerank）
  // biome-ignore lint/suspicious/noExplicitAny: eval 時のみ env proxy を上書き
  (env as any).GOOGLE_GENERATIVE_AI_API_KEY = googleKey;

  // biome-ignore lint/suspicious/noExplicitAny: .dev.vars の追加キーは CloudflareBindings に未定義
  const openaiKey = (env as any).OPENAI_API_KEY as string | undefined;
  if (openaiKey) {
    process.env.OPENAI_API_KEY = openaiKey;
    console.log("🔑 OpenAI APIキーを使用（スコアラー: gpt-5-nano）");
  } else {
    console.warn(
      "⚠️ OPENAI_API_KEY が未設定。エージェント実行とスコアラーが失敗します",
    );
  }
};

// ─── CLI引数パース ────────────────────────────────────────

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    n: 5,
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
      case "--case-id":
        result.caseId = args[++i];
        break;
      case "--category":
        result.category = args[++i] as TestCategory;
        break;
      case "--env":
        result.env = args[++i] as EnvName;
        break;
      case "--compare":
        result.compare = true;
        break;
      case "--interval":
        result.interval = Number.parseInt(args[++i], 10);
        break;
      case "--batch-size":
        result.batchSize = Number.parseInt(args[++i], 10);
        break;
      case "--from":
        result.from = Number.parseInt(args[++i], 10);
        break;
      case "--to":
        result.to = Number.parseInt(args[++i], 10);
        break;
    }
  }

  return result;
};

// ─── Code-based Grader ──────────────────────────────────

const checkRequiredKeywords = (
  answer: string,
  keywords: string[],
  testType: TestType,
): KeywordCheckResult => {
  if (keywords.length === 0) {
    return { pass: true, matchedKeywords: [], missingKeywords: [], score: 1.0 };
  }

  const normalizedAnswer = answer.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of keywords) {
    if (normalizedAnswer.includes(kw.toLowerCase())) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  if (testType === "negative") {
    // ネガティブケース: いずれか1つでも含まれていれば pass（OR条件）
    const pass = matched.length > 0;
    return {
      pass,
      matchedKeywords: matched,
      missingKeywords: missing,
      score: pass ? 1.0 : 0.0,
    };
  }

  // ポジティブケース: 全て含まれていれば pass（AND条件）
  const score = matched.length / keywords.length;
  return {
    pass: missing.length === 0,
    matchedKeywords: matched,
    missingKeywords: missing,
    score,
  };
};

// ─── URL Validation ─────────────────────────────────────

const URL_REGEX = /https?:\/\/[^\s)<>\]]+/g;

const ALLOWED_DOMAINS = [
  "www.otoineppu-h.ed.jp",
  "www.vill.otoineppu.hokkaido.jp",
];

const extractUrls = (text: string): string[] => {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  // 末尾の句読点やカッコを除去
  return [
    ...new Set(matches.map((u) => u.replace(/[.,;:!?）】」。、]+$/, ""))),
  ];
};

const checkUrlAccessibility = async (
  url: string,
  timeoutMs = 5000,
): Promise<{ url: string; status: number | "error" }> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    return { url, status: res.status };
  } catch {
    return { url, status: "error" };
  }
};

const validateUrls = async (
  answer: string,
  testCase: TestCaseV3,
): Promise<UrlValidationResult | null> => {
  // URL 検証が不要なテストケースはスキップ
  if (!testCase.expectedUrl && !testCase.noUrlExpected) return null;

  const urls = extractUrls(answer);

  // noUrlExpected の場合: URL が含まれていなければ OK
  if (testCase.noUrlExpected) {
    return {
      urls,
      accessibleUrls: [],
      inaccessibleUrls: [],
      expectedUrlMatch: null,
      domainValidRate: urls.length === 0 ? 1.0 : 0.0,
      accessibleRate: urls.length === 0 ? 1.0 : null,
    };
  }

  // URL の HTTP HEAD 検証
  const results = await Promise.all(urls.map((u) => checkUrlAccessibility(u)));
  const accessible = results.filter((r) => r.status === 200);
  const inaccessible = results.filter((r) => r.status !== 200);

  // 期待 URL との一致
  const expectedUrlMatch = testCase.expectedUrl
    ? urls.some((u) => u === testCase.expectedUrl)
    : null;

  // ドメイン検証
  const domainValid = urls.filter((u) => {
    try {
      const host = new URL(u).hostname;
      return ALLOWED_DOMAINS.includes(host);
    } catch {
      return false;
    }
  });

  return {
    urls,
    accessibleUrls: accessible.map((r) => r.url),
    inaccessibleUrls: inaccessible.map((r) => ({
      url: r.url,
      status: r.status,
    })),
    expectedUrlMatch,
    domainValidRate: urls.length > 0 ? domainValid.length / urls.length : null,
    accessibleRate: urls.length > 0 ? accessible.length / urls.length : null,
  };
};

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

const isPass = (
  scores: Scores,
  keywordResult: KeywordCheckResult,
  answer: string,
  threshold: number,
  testType: "positive" | "negative" = "positive",
): boolean => {
  if (testType === "negative") {
    // negative: 棄権 or KWにマッチ（「ありません」等）すれば PASS
    return isAbstention(answer) || keywordResult.pass;
  }
  // positive: 棄権でない + KW全マッチ + sim >= threshold
  if (isAbstention(answer)) return false;
  if (!keywordResult.pass) return false;
  const sim = scores.similarity;
  if (sim === null || sim < threshold) return false;
  return true;
};

// ─── pass@k / pass^k 計算 ───────────────────────────────

const comb = (n: number, k: number): number => {
  if (k > n || k < 0) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
};

const passAtK = (n: number, c: number, k: number): number => {
  if (n === 0 || k > n) return 0;
  if (c === n) return 1;
  return 1 - comb(n - c, k) / comb(n, k);
};

const passHatK = (n: number, c: number, k: number): number => {
  if (n === 0 || k > n) return 0;
  return comb(c, k) / comb(n, k);
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
    const msg = (e as Error).message ?? "";
    // FIXME(@mastra/evals): matchType "contradiction" が Zod enum に含まれず ZodError になる。
    // Mastra 修正後はこの catch に入らなくなるため、ログで検知可能。
    if (msg.includes("contradiction") || msg.includes("invalid_enum_value")) {
      console.warn(
        "  ⚠ similarity: contradiction matchType detected (Mastra enum bug) → 0.0",
      );
      scores.similarity = 0.0;
    } else {
      console.warn("  ⚠ similarity scorer failed:", msg);
    }
  }

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

  // contextRelevance: 構造化出力が間欠的に失敗することがあるためリトライ付き
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

  return { averageScores: avg, stdDev, min, max };
};

const calcPassMetrics = (timeline: IterationResult[]): PassMetrics => {
  const completed = timeline.filter((r) => !r.error);
  const n = completed.length;
  const passCount = completed.filter((r) => r.pass).length;
  const failCount = n - passCount;
  const abstentionCount = completed.filter((r) =>
    isAbstention(r.answer),
  ).length;
  const kwPassCount = completed.filter((r) => r.keywordCheck.pass).length;

  return {
    passCount,
    failCount,
    abstentionCount,
    passRate: n > 0 ? Math.round((passCount / n) * 1000) / 1000 : 0,
    keywordPassRate: n > 0 ? Math.round((kwPassCount / n) * 1000) / 1000 : 0,
    passAtK: {
      k1: Math.round(passAtK(n, passCount, 1) * 1000) / 1000,
      k3: Math.round(passAtK(n, passCount, 3) * 1000) / 1000,
      k5: Math.round(passAtK(n, passCount, 5) * 1000) / 1000,
    },
    passHatK: {
      k1: Math.round(passHatK(n, passCount, 1) * 1000) / 1000,
      k3: Math.round(passHatK(n, passCount, 3) * 1000) / 1000,
      k5: Math.round(passHatK(n, passCount, 5) * 1000) / 1000,
    },
  };
};

// ─── 全体サマリー計算 ───────────────────────────────────

const calcOverallSummary = (results: EvalResult[]): OverallSummary => {
  const totalTestCases = results.length;
  const passedTestCases = results.filter(
    (r) => r.summary.passRate >= 0.5,
  ).length;
  const failedTestCases = totalTestCases - passedTestCases;

  // カテゴリ別
  const byCategory: OverallSummary["byCategory"] = {};
  for (const r of results) {
    const cat = r.metadata.category;
    if (!byCategory[cat]) {
      byCategory[cat] = {
        count: 0,
        passedCount: 0,
        avgSimilarity: 0,
        avgPassRate: 0,
      };
    }
    byCategory[cat].count++;
    if (r.summary.passRate >= 0.5) byCategory[cat].passedCount++;
    byCategory[cat].avgSimilarity += r.summary.averageScores.similarity ?? 0;
    byCategory[cat].avgPassRate += r.summary.passRate;
  }
  for (const cat of Object.keys(byCategory)) {
    const c = byCategory[cat];
    c.avgSimilarity = Math.round((c.avgSimilarity / c.count) * 1000) / 1000;
    c.avgPassRate = Math.round((c.avgPassRate / c.count) * 1000) / 1000;
  }

  // タイプ別
  const positives = results.filter((r) => r.metadata.testType === "positive");
  const negatives = results.filter((r) => r.metadata.testType === "negative");
  const byType = {
    positive: {
      count: positives.length,
      passedCount: positives.filter((r) => r.summary.passRate >= 0.5).length,
      avgPassRate:
        positives.length > 0
          ? Math.round(
              (positives.reduce((sum, r) => sum + r.summary.passRate, 0) /
                positives.length) *
                1000,
            ) / 1000
          : 0,
    },
    negative: {
      count: negatives.length,
      passedCount: negatives.filter((r) => r.summary.passRate >= 0.5).length,
      avgPassRate:
        negatives.length > 0
          ? Math.round(
              (negatives.reduce((sum, r) => sum + r.summary.passRate, 0) /
                negatives.length) *
                1000,
            ) / 1000
          : 0,
    },
  };

  // 全体 pass@k / pass^k（全イテレーションを集約）
  const allTimeline = results.flatMap((r) => r.timeline);
  const allCompleted = allTimeline.filter((r) => !r.error);
  const allN = allCompleted.length;
  const allPassCount = allCompleted.filter((r) => r.pass).length;

  return {
    totalTestCases,
    passedTestCases,
    failedTestCases,
    overallPassRate:
      totalTestCases > 0
        ? Math.round((passedTestCases / totalTestCases) * 1000) / 1000
        : 0,
    byCategory,
    byType,
    passAtK: {
      k1: Math.round(passAtK(allN, allPassCount, 1) * 1000) / 1000,
      k3: Math.round(passAtK(allN, allPassCount, 3) * 1000) / 1000,
      k5: Math.round(passAtK(allN, allPassCount, 5) * 1000) / 1000,
    },
    passHatK: {
      k1: Math.round(passHatK(allN, allPassCount, 1) * 1000) / 1000,
      k3: Math.round(passHatK(allN, allPassCount, 3) * 1000) / 1000,
      k5: Math.round(passHatK(allN, allPassCount, 5) * 1000) / 1000,
    },
  };
};

// ─── ファイル名生成 ───────────────────────────────────────

const generateFilePrefix = (
  envLabel: string,
  agent: string,
  label: string,
  n: number,
): string => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const slug = label.slice(0, 10).replace(/[?？\s/\\]/g, "");
  return `${date}_${time}_${envLabel}_${agent}_v3_${slug}_n${n}`;
};

// ─── HTML生成（個別テストケース） ──────────────────────────

const generateHtml = (result: EvalResult): string => {
  const { metadata, summary, timeline } = result;

  const scoreLabels = JSON.stringify(SCORE_NAMES);
  const avgValues = JSON.stringify(
    SCORE_NAMES.map((n) => summary.averageScores[n] ?? 0),
  );

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

  const summaryRows = SCORE_NAMES.map(
    (name) =>
      `<tr>
        <td>${name}<br><span style="font-size:0.75rem;color:#888;">${SCORE_DESCRIPTIONS[name]}</span></td>
        <td>${summary.averageScores[name]?.toFixed(3) ?? "N/A"}</td>
        <td>${summary.stdDev[name]?.toFixed(3) ?? "N/A"}</td>
        <td>${summary.min[name]?.toFixed(3) ?? "N/A"}</td>
        <td>${summary.max[name]?.toFixed(3) ?? "N/A"}</td>
      </tr>`,
  ).join("\n");

  const passBadge = (pass: boolean) =>
    pass
      ? '<span style="background:#22c55e;color:white;padding:2px 8px;border-radius:4px;font-size:0.75rem;">PASS</span>'
      : '<span style="background:#ef4444;color:white;padding:2px 8px;border-radius:4px;font-size:0.75rem;">FAIL</span>';

  const answersHtml = timeline
    .map((r) => {
      const scoresText = SCORE_NAMES.map(
        (n) =>
          `${n}: ${r.scores[n] !== null ? r.scores[n]?.toFixed(3) : "N/A"}`,
      ).join(" | ");
      const kwText =
        r.keywordCheck.matchedKeywords.length > 0 ||
        r.keywordCheck.missingKeywords.length > 0
          ? ` | kw=${r.keywordCheck.matchedKeywords.length}/${r.keywordCheck.matchedKeywords.length + r.keywordCheck.missingKeywords.length}${r.keywordCheck.missingKeywords.length > 0 ? ` missing=[${r.keywordCheck.missingKeywords.join(",")}]` : ""}`
          : "";
      const escapedAnswer = r.answer
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
  <summary style="font-size:0.8rem;color:#6b7280;">Transcript (${r.transcript.reduce((sum, s) => sum + s.toolCalls.length, 0)} tool calls)</summary>
  <pre style="font-size:0.75rem;background:#f8f8f8;padding:8px;overflow-x:auto;max-height:300px;">${JSON.stringify(r.transcript, null, 2).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</details>`
          : "";

      return `<details>
  <summary>#${r.iteration} ${passBadge(r.pass)} (${r.durationMs}ms) — ${scoresText}${kwText}</summary>
  <div class="answer-detail">
    ${errorHtml}
    <p>${escapedAnswer}</p>
    ${transcriptHtml}
  </div>
</details>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Eval V3: [${metadata.testCaseId}] ${metadata.question} (${metadata.environment})</title>
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
  .pass-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
  .metric-card { background: #f8f8f8; border-radius: 6px; padding: 12px; text-align: center; }
  .metric-card .value { font-size: 1.5rem; font-weight: 700; }
  .metric-card .label { font-size: 0.8rem; color: #666; margin-top: 4px; }
  .metric-card .desc { font-size: 0.7rem; color: #999; margin-top: 2px; }
</style>
</head>
<body>

<h1>Eval V3 Report: ${metadata.testCaseId}</h1>
<div class="meta">
  <strong>質問:</strong> ${metadata.question}<br>
  <strong>期待回答:</strong> ${metadata.groundTruth}<br>
  <strong>カテゴリ:</strong> ${metadata.category} | <strong>タイプ:</strong> ${metadata.testType} | <strong>閾値:</strong> ${metadata.threshold}<br>
  <strong>必須キーワード:</strong> [${metadata.requiredKeywords.join(", ")}]<br>
  <strong>エージェント:</strong> ${metadata.agent} | <strong>環境:</strong> ${metadata.environment} | <strong>実行回数:</strong> ${metadata.completedIterations}/${metadata.iterations}<br>
  <strong>所要時間:</strong> ${(metadata.totalDurationMs / 1000).toFixed(1)}s | <strong>トークン:</strong> ${metadata.totalTokens.total.toLocaleString()}<br>
  <strong>タイムスタンプ:</strong> ${metadata.timestamp}
</div>

<div class="card" style="margin-bottom:24px;">
  <h2>Pass/Fail メトリクス</h2>
  <div class="pass-metrics">
    <div class="metric-card">
      <div class="value" style="color:${summary.passRate >= 0.5 ? "#22c55e" : "#ef4444"}">${(summary.passRate * 100).toFixed(0)}%</div>
      <div class="label">Pass Rate (${summary.passCount}/${summary.passCount + summary.failCount})</div>
      <div class="desc">総合合格率</div>
    </div>
    <div class="metric-card">
      <div class="value">${(summary.keywordPassRate * 100).toFixed(0)}%</div>
      <div class="label">Keyword Pass Rate</div>
      <div class="desc">必須キーワードの出現率</div>
    </div>
    <div class="metric-card">
      <div class="value">${summary.passAtK.k1.toFixed(3)}</div>
      <div class="label">pass@1</div>
      <div class="desc">1回で正解する確率</div>
    </div>
    <div class="metric-card">
      <div class="value">${summary.passHatK.k3.toFixed(3)}</div>
      <div class="label">pass^3</div>
      <div class="desc">3回連続で正解する確率</div>
    </div>
  </div>
  <table style="margin-top:12px;">
    <thead><tr><th>k</th><th>pass@k<br><span style="font-weight:normal;font-size:0.75rem;color:#888;">k回中1回以上正解する確率</span></th><th>pass^k<br><span style="font-weight:normal;font-size:0.75rem;color:#888;">k回連続で正解する確率</span></th></tr></thead>
    <tbody>
      <tr><td>1</td><td>${summary.passAtK.k1.toFixed(3)}</td><td>${summary.passHatK.k1.toFixed(3)}</td></tr>
      <tr><td>3</td><td>${summary.passAtK.k3.toFixed(3)}</td><td>${summary.passHatK.k3.toFixed(3)}</td></tr>
      <tr><td>5</td><td>${summary.passAtK.k5.toFixed(3)}</td><td>${summary.passHatK.k5.toFixed(3)}</td></tr>
    </tbody>
  </table>
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

// ─── HTML生成（全体サマリー） ────────────────────────────

const generateOverallHtml = (
  overallSummary: OverallSummary,
  results: EvalResult[],
  envLabel: string,
): string => {
  const testCaseRows = results
    .map((r) => {
      const passColor = r.summary.passRate >= 0.5 ? "#22c55e" : "#ef4444";
      const passLabel = r.summary.passRate >= 0.5 ? "PASS" : "FAIL";
      return `<tr>
        <td>${r.metadata.testCaseId}</td>
        <td>${r.metadata.category}</td>
        <td>${r.metadata.testType}</td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.metadata.question}</td>
        <td><span style="background:${passColor};color:white;padding:2px 8px;border-radius:4px;font-size:0.75rem;">${passLabel}</span></td>
        <td>${(r.summary.passRate * 100).toFixed(0)}%</td>
        <td>${r.summary.averageScores.similarity?.toFixed(3) ?? "N/A"}</td>
        <td>${r.summary.passAtK.k1.toFixed(3)}</td>
        <td>${r.summary.passHatK.k3.toFixed(3)}</td>
      </tr>`;
    })
    .join("\n");

  const categoryRows = Object.entries(overallSummary.byCategory)
    .map(
      ([cat, data]) =>
        `<tr>
        <td>${cat}</td>
        <td>${data.passedCount}/${data.count}</td>
        <td>${(data.avgPassRate * 100).toFixed(0)}%</td>
        <td>${data.avgSimilarity.toFixed(3)}</td>
      </tr>`,
    )
    .join("\n");

  const categories = Object.keys(overallSummary.byCategory);
  const categoryLabels = JSON.stringify(categories);
  const categoryAvgSim = JSON.stringify(
    categories.map((c) => overallSummary.byCategory[c].avgSimilarity),
  );
  const categoryAvgPass = JSON.stringify(
    categories.map((c) => overallSummary.byCategory[c].avgPassRate),
  );

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Eval V3 Summary (${envLabel})</title>
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
  canvas { max-height: 350px; }
  .pass-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
  .metric-card { background: #f8f8f8; border-radius: 6px; padding: 12px; text-align: center; }
  .metric-card .value { font-size: 1.5rem; font-weight: 700; }
  .metric-card .label { font-size: 0.8rem; color: #666; margin-top: 4px; }
  .metric-card .desc { font-size: 0.7rem; color: #999; margin-top: 2px; }
</style>
</head>
<body>

<h1>Eval V3 全体サマリー</h1>
<div class="meta">
  <strong>環境:</strong> ${envLabel} | <strong>テストケース数:</strong> ${overallSummary.totalTestCases} | <strong>タイムスタンプ:</strong> ${new Date().toISOString()}
</div>

<div class="card">
  <h2>全体メトリクス</h2>
  <div class="pass-metrics">
    <div class="metric-card">
      <div class="value" style="color:${overallSummary.overallPassRate >= 0.5 ? "#22c55e" : "#ef4444"}">${overallSummary.passedTestCases}/${overallSummary.totalTestCases}</div>
      <div class="label">PASS / Total</div>
    </div>
    <div class="metric-card">
      <div class="value">${(overallSummary.overallPassRate * 100).toFixed(0)}%</div>
      <div class="label">Overall Pass Rate</div>
    </div>
    <div class="metric-card">
      <div class="value">${overallSummary.passAtK.k1.toFixed(3)}</div>
      <div class="label">pass@1 (全体)</div>
    </div>
    <div class="metric-card">
      <div class="value">${overallSummary.passHatK.k3.toFixed(3)}</div>
      <div class="label">pass^3 (全体)</div>
    </div>
    <div class="metric-card">
      <div class="value">${overallSummary.byType.positive.passedCount}/${overallSummary.byType.positive.count}</div>
      <div class="label">Positive PASS</div>
    </div>
    <div class="metric-card">
      <div class="value">${overallSummary.byType.negative.passedCount}/${overallSummary.byType.negative.count}</div>
      <div class="label">Negative PASS</div>
    </div>
  </div>
</div>

<div class="grid">
  <div class="card" style="margin-bottom:0;">
    <h2>カテゴリ別レーダー</h2>
    <canvas id="categoryRadar"></canvas>
  </div>
  <div class="card" style="margin-bottom:0;">
    <h2>カテゴリ別サマリー</h2>
    <table>
      <thead><tr><th>カテゴリ</th><th>PASS</th><th>Pass Rate</th><th>Avg Similarity</th></tr></thead>
      <tbody>${categoryRows}</tbody>
    </table>
  </div>
</div>

<div class="card">
  <h2>テストケース一覧</h2>
  <table>
    <thead><tr><th>ID</th><th>カテゴリ</th><th>タイプ</th><th>質問</th><th>判定</th><th>Pass Rate</th><th>Similarity</th><th>pass@1</th><th>pass^3</th></tr></thead>
    <tbody>${testCaseRows}</tbody>
  </table>
</div>

<script>
new Chart(document.getElementById('categoryRadar'), {
  type: 'radar',
  data: {
    labels: ${categoryLabels},
    datasets: [
      {
        label: 'Avg Similarity',
        data: ${categoryAvgSim},
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgb(54, 162, 235)',
      },
      {
        label: 'Avg Pass Rate',
        data: ${categoryAvgPass},
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgb(75, 192, 192)',
      },
    ]
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

// ─── 比較HTML生成 ──────────────────────────────────────────

const generateCompareHtml = (
  entries: CompareEntry[],
  testCaseId: string,
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

    return `<tr><td>${name}</td>${cells}</tr>`;
  }).join("\n");

  const passMetricsRows = entries
    .map(
      ({ env, result }) =>
        `<tr>
        <td>${ENV_LABELS[env]}</td>
        <td>${(result.summary.passRate * 100).toFixed(0)}%</td>
        <td>${result.summary.passAtK.k1.toFixed(3)}</td>
        <td>${result.summary.passHatK.k3.toFixed(3)}</td>
        <td>${(result.metadata.totalDurationMs / 1000).toFixed(1)}s</td>
        <td>${result.metadata.totalTokens.total.toLocaleString()}</td>
      </tr>`,
    )
    .join("\n");

  const envHeaders = entries
    .map(({ env }) => `<th>${ENV_LABELS[env]}</th>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Eval V3 Compare: [${testCaseId}] ${question}</title>
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
</style>
</head>
<body>

<h1>Eval V3 環境比較: ${testCaseId}</h1>
<div class="meta">
  <strong>質問:</strong> ${question}<br>
  <strong>期待回答:</strong> ${groundTruth}
</div>

<div class="grid">
  <div class="card" style="margin-bottom:0;">
    <h2>レーダーチャート</h2>
    <canvas id="radarChart"></canvas>
  </div>
  <div class="card" style="margin-bottom:0;">
    <h2>スコア比較</h2>
    <table>
      <thead><tr><th>指標</th>${envHeaders}</tr></thead>
      <tbody>${comparisonRows}</tbody>
    </table>
  </div>
</div>

<div class="card">
  <h2>Pass メトリクス比較</h2>
  <table>
    <thead><tr><th>環境</th><th>Pass Rate</th><th>pass@1</th><th>pass^3</th><th>所要時間</th><th>トークン</th></tr></thead>
    <tbody>${passMetricsRows}</tbody>
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
  testCase: TestCaseV3;
  agent: typeof knowledgeAgent;
  requestContext: RequestContext;
  n: number;
  agentName: string;
  envName: EnvName;
}): Promise<EvalResult> => {
  const { testCase, agent, requestContext, n, agentName, envName } = params;

  console.log(`\n[${testCase.id}] ${testCase.input}`);

  const timeline: IterationResult[] = [];
  const totalStart = Date.now();

  for (let i = 0; i < n; i++) {
    const iterStart = Date.now();
    const iterNum = i + 1;

    try {
      process.stdout.write(`  [${iterNum}/${n}] `);

      const result = await agent.generate(testCase.input, {
        requestContext,
        maxSteps: 3,
      });
      const retrievedChunks = extractKnowledgeSearchResults(
        // biome-ignore lint/suspicious/noExplicitAny: agent.generate の戻り値型は不定
        (result as any).steps,
      );
      const context = retrievedChunks.map((c) => c.content);

      const transcript = extractTranscript(
        // biome-ignore lint/suspicious/noExplicitAny: agent.generate の戻り値型は不定
        (result as any).steps,
      );

      const abstentionDetected = isAbstention(result.text);

      const scores = await runEvalScorers({
        input: testCase.input,
        output: result.text,
        groundTruth: testCase.groundTruth,
        context,
        abstention: abstentionDetected,
      });

      const keywordCheck = checkRequiredKeywords(
        result.text,
        testCase.requiredKeywords,
        testCase.type,
      );

      const pass = isPass(
        scores,
        keywordCheck,
        result.text,
        testCase.threshold,
        testCase.type,
      );

      // URL 検証（expectedUrl または noUrlExpected が設定されている場合のみ）
      const urlValidation = await validateUrls(result.text, testCase);

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

      timeline.push({
        iteration: iterNum,
        answer: result.text,
        scores,
        keywordCheck,
        urlValidation,
        pass,
        durationMs,
        usage,
        error: null,
        transcript,
      });

      const simScore = scores.similarity?.toFixed(3) ?? "N/A";
      const kwInfo = `kw=${keywordCheck.matchedKeywords.length}/${keywordCheck.matchedKeywords.length + keywordCheck.missingKeywords.length}`;
      const passIcon = pass ? "✅ PASS" : "❌ FAIL";
      const tokenInfo = usage ? ` tok=${usage.totalTokens}` : "";
      const urlInfo = urlValidation
        ? ` url=${urlValidation.accessibleRate !== null ? `${(urlValidation.accessibleRate * 100).toFixed(0)}%` : "N/A"}${urlValidation.expectedUrlMatch === false ? " ⚠url-mismatch" : ""}`
        : "";
      console.log(
        `${passIcon} (${durationMs}ms) sim=${simScore} ${kwInfo}${tokenInfo}${urlInfo}`,
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
        keywordCheck: {
          pass: false,
          matchedKeywords: [],
          missingKeywords: testCase.requiredKeywords,
          score: 0,
        },
        urlValidation: null,
        pass: false,
        durationMs,
        usage: null,
        error: errorMsg,
        transcript: [],
      });
      console.log(`❌ ERROR (${durationMs}ms) ${errorMsg}`);
    }

    // イテレーション間インターバル（最後のイテレーション以外）
    if (i < n - 1) {
      await sleep(2000);
    }
  }

  const totalDurationMs = Date.now() - totalStart;
  const stats = calcStats(timeline);
  const passMetrics = calcPassMetrics(timeline);
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

  const summary = { ...stats, ...passMetrics };

  console.log(
    `  → passRate: ${(passMetrics.passRate * 100).toFixed(0)}% | pass@1=${passMetrics.passAtK.k1.toFixed(3)} | pass^3=${passMetrics.passHatK.k3.toFixed(3)}`,
  );

  return {
    metadata: {
      testCaseId: testCase.id,
      category: testCase.category,
      testType: testCase.type,
      question: testCase.input,
      groundTruth: testCase.groundTruth,
      requiredKeywords: testCase.requiredKeywords,
      threshold: testCase.threshold,
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
  let testCases: TestCaseV3[];

  if (args.question && args.truth) {
    testCases = [
      {
        id: "adhoc",
        category: "village-overview",
        type: "positive",
        input: args.question,
        groundTruth: args.truth,
        requiredKeywords: [],
        threshold: 0.5,
      },
    ];
  } else if (args.caseId) {
    // 前方一致: "ur-" で ur-01〜ur-25 全てにマッチ
    const caseId = args.caseId as string;
    const matched = evalV3TestCases.filter((c) => c.id.startsWith(caseId));
    if (matched.length === 0) {
      // 完全一致フォールバック
      const tc = evalV3TestCases.find((c) => c.id === args.caseId);
      if (!tc) {
        console.error(
          `❌ テストケース ID "${args.caseId}" が見つかりません。有効なID: ${evalV3TestCases.map((c) => c.id).join(", ")}`,
        );
        process.exit(1);
      }
      testCases = [tc];
    } else {
      testCases = matched;
    }
  } else if (args.caseIndex !== undefined) {
    const tc = evalV3TestCases[args.caseIndex];
    if (!tc) {
      console.error(
        `❌ テストケース #${args.caseIndex} が見つかりません（0-${evalV3TestCases.length - 1}）`,
      );
      process.exit(1);
    }
    testCases = [tc];
  } else if (args.category) {
    testCases = evalV3TestCases.filter((c) => c.category === args.category);
    if (testCases.length === 0) {
      console.error(
        `❌ カテゴリ "${args.category}" のテストケースが見つかりません`,
      );
      process.exit(1);
    }
  } else {
    testCases = evalV3TestCases;
  }

  // --from/--to によるテストケース範囲フィルタリング（子プロセス用）
  if (args.from !== undefined && args.to !== undefined) {
    testCases = testCases.slice(args.from, args.to + 1);
  }

  // --batch-size によるプロセス分割モード（親プロセス）
  // --from/--to と併用可能: 指定範囲内でさらにバッチ分割する
  if (args.batchSize) {
    const total = testCases.length;
    const batchSize = args.batchSize;
    const batches = Math.ceil(total / batchSize);
    const globalFrom = args.from ?? 0;

    console.log("🔄 Eval V3 バッチ分割モード");
    console.log(
      `   テストケース数: ${total}${args.from !== undefined ? ` (ケース ${args.from}〜${args.to})` : ""}`,
    );
    console.log(`   バッチサイズ: ${batchSize}`);
    console.log(`   バッチ数: ${batches}`);
    console.log();

    const baseArgs = process.argv
      .slice(2)
      .filter(
        (a, i, arr) =>
          a !== "--batch-size" &&
          arr[i - 1] !== "--batch-size" &&
          a !== "--from" &&
          arr[i - 1] !== "--from" &&
          a !== "--to" &&
          arr[i - 1] !== "--to",
      );

    for (let batch = 0; batch < batches; batch++) {
      const from = globalFrom + batch * batchSize;
      const to = Math.min(from + batchSize - 1, globalFrom + total - 1);

      console.log(
        `\n━━━ バッチ ${batch + 1}/${batches} (ケース ${from}〜${to}) ━━━`,
      );

      const cmd = `tsx scripts/run-eval-v3.ts ${baseArgs.join(" ")} --from ${from} --to ${to}`;
      try {
        execSync(cmd, {
          stdio: "inherit",
          cwd: path.resolve(import.meta.dirname, ".."),
          timeout: 7_200_000, // 2時間/バッチ
        });
      } catch (e) {
        console.error(
          `❌ バッチ ${batch + 1} でエラー:`,
          e instanceof Error ? e.message : e,
        );
      }

      if (batch < batches - 1) {
        console.log("⏳ バッチ間インターバル（5秒）...");
        await sleep(5000);
      }
    }

    console.log("\n✅ Eval V3 全バッチ完了");
    return;
  }

  console.log("🔄 Eval V3 開始");
  console.log(`   エージェント: ${args.agent}`);
  console.log("   モデル: 本番同一（gpt-5.6）");
  console.log(`   テストケース数: ${testCases.length}`);
  console.log(`   各N回: ${args.n}`);
  console.log(
    `   環境: ${args.compare ? "環境比較 (local → dev → prd)" : args.env}`,
  );
  if (testCases.length > 1 && args.interval > 0) {
    console.log(`   インターバル: ${args.interval}秒（テストケース間）`);
  }

  const libsqlStore = new LibSQLStore({
    id: "mastra-storage",
    url: "file:mastra.db",
  });

  const agentMap: Record<string, ReturnType<typeof createNeppChanAgent>> = {
    knowledge: knowledgeAgent,
    "nepp-chan": createNeppChanAgent({
      isAdmin: false,
      modelConfig: resolveModelTier({
        intent: "thinking",
        platform: "web",
        isAdmin: false,
      }),
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
  const CALLS_PER_ITERATION = 22; // 実測ベース（チャット+thinking+rerank+embed）
  const envCount = args.compare ? 3 : 1;
  const estimatedAgentCalls =
    testCases.length * args.n * CALLS_PER_ITERATION * envCount;
  const estimatedScorerCalls = testCases.length * args.n * 4 * envCount;
  const OPENAI_RPM = 500;
  const estimatedDurationMin = Math.ceil(
    (testCases.length * args.n * 70 * envCount) / 60,
  );

  console.log("─── クォータ事前チェック ─────────────────────────");
  console.log(
    `   OpenAI 推定リクエスト数: ${(estimatedAgentCalls + estimatedScorerCalls).toLocaleString()} (RPM ${OPENAI_RPM})`,
  );
  console.log(`   推定実行時間: ${estimatedDurationMin}分`);
  console.log("─────────────────────────────────────────────────\n");

  const outputDir = path.resolve(
    import.meta.dirname,
    "../../dataset/eval/results",
  );
  fs.mkdirSync(outputDir, { recursive: true });

  if (args.compare) {
    // ─── 環境比較モード ───────────────────────────────────
    if (testCases.length !== 1) {
      console.error(
        "❌ --compare モードではテストケースを1つ指定してください（--case-id または --case）",
      );
      process.exit(1);
    }
    const testCase = testCases[0];
    const entries: CompareEntry[] = [];

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

      const result = await runTestCaseEval({
        testCase,
        agent,
        requestContext,
        n: args.n,
        agentName: args.agent,
        envName,
      });

      const envLabel = ENV_LABELS[envName];
      const prefix = generateFilePrefix(
        envLabel,
        args.agent,
        testCase.id,
        args.n,
      );
      const jsonPath = path.join(outputDir, `${prefix}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
      console.log(`📁 JSON: ${jsonPath}`);

      entries.push({ env: envName, result });
      await dispose();
    }

    const comparePrefix = generateFilePrefix(
      "compare",
      args.agent,
      testCase.id,
      args.n,
    );
    const compareHtmlPath = path.join(outputDir, `${comparePrefix}.html`);
    fs.writeFileSync(
      compareHtmlPath,
      generateCompareHtml(
        entries,
        testCase.id,
        testCase.input,
        testCase.groundTruth,
      ),
    );
    console.log(`\n📊 比較レポート: ${compareHtmlPath}`);
  } else {
    // ─── 単一環境モード ────────────────────────────────────

    // Vectorize リモートバインディングのセッション安定性対策:
    // getPlatformProxy は長時間稼働で認証トークンが劣化し VECTOR_QUERY_ERROR が発生する。
    // --batch-size オプションでプロセス分割し、各バッチで新鮮なセッションを使用する。

    const { env, dispose } = await getPlatformProxy<CloudflareBindings>({
      configPath: "wrangler.jsonc",
      environment: args.env,
      remoteBindings: true,
    });
    resolveEvalApiKeys(env);
    const requestContext = new RequestContext();
    requestContext.set("env", env);

    const allResults: EvalResult[] = [];

    for (let tcIdx = 0; tcIdx < testCases.length; tcIdx++) {
      const testCase = testCases[tcIdx];
      const result = await runTestCaseEval({
        testCase,
        agent,
        requestContext,
        n: args.n,
        agentName: args.agent,
        envName: args.env,
      });

      allResults.push(result);

      const envLabel = ENV_LABELS[args.env];
      const prefix = generateFilePrefix(
        envLabel,
        args.agent,
        testCase.id,
        args.n,
      );
      const jsonPath = path.join(outputDir, `${prefix}.json`);
      const htmlPath = path.join(outputDir, `${prefix}.html`);

      fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
      fs.writeFileSync(htmlPath, generateHtml(result));
      console.log(`📁 JSON: ${jsonPath}`);
      console.log(`📁 HTML: ${htmlPath}`);

      // テストケース間のインターバル（最後のケース以外）
      if (args.interval > 0 && tcIdx < testCases.length - 1) {
        console.log(`\n⏳ ${args.interval}秒インターバル...`);
        await sleep(args.interval * 1000);
      }
    }

    // 全体サマリー（複数テストケースの場合）
    if (allResults.length > 1) {
      const overallSummary = calcOverallSummary(allResults);
      const envLabel = ENV_LABELS[args.env];
      const summaryPrefix = generateFilePrefix(
        envLabel,
        args.agent,
        "summary",
        args.n,
      );
      const summaryJsonPath = path.join(outputDir, `${summaryPrefix}.json`);
      const summaryHtmlPath = path.join(outputDir, `${summaryPrefix}.html`);

      fs.writeFileSync(
        summaryJsonPath,
        JSON.stringify(overallSummary, null, 2),
      );
      fs.writeFileSync(
        summaryHtmlPath,
        generateOverallHtml(overallSummary, allResults, envLabel),
      );

      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📊 全体サマリー");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`全テストケース: ${overallSummary.totalTestCases}`);
      console.log(
        `PASS: ${overallSummary.passedTestCases} / FAIL: ${overallSummary.failedTestCases}`,
      );
      console.log(
        `全体 pass@1: ${overallSummary.passAtK.k1.toFixed(3)} | pass^3: ${overallSummary.passHatK.k3.toFixed(3)}`,
      );

      console.log("\nカテゴリ別:");
      for (const [cat, data] of Object.entries(overallSummary.byCategory)) {
        console.log(
          `  ${cat.padEnd(20)} ${data.passedCount}/${data.count} PASS  avg_sim=${data.avgSimilarity.toFixed(3)}`,
        );
      }

      console.log(`\n📁 サマリー: ${summaryHtmlPath}`);
    }

    await dispose();
  }

  console.log("✅ Eval V3 完了");
};

main().catch((error) => {
  console.error("❌ エラーが発生しました:", error);
  process.exit(1);
});
