import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import { classifyIntent } from "../src/lib/classify-intent";
import {
  askJev,
  JEV_MODEL,
  JevHttpError,
  type JevQuestion,
} from "../src/lib/jev";
import { loadDevVars, serverRoot } from "../src/mastra/evals/neppchan/dev-vars";
import { type IntentCase, intentCases } from "./data/intent-cases";

type Intent = IntentCase["expected"];
type Variant = "A" | "B" | "C" | "D";
const VARIANTS: Variant[] = ["A", "B", "C", "D"];
const THRESHOLDS = Array.from({ length: 9 }, (_, i) => (30 + i * 5) / 100);

type JevRecord = {
  caseId: string;
  variant: Variant;
  run: number;
  model: string | null;
  choice: Intent | null;
  pThinking: number | null;
  confidence: number | null;
  latencyMs: number;
  inputTokens: number | null;
  error?: string;
};

type LunaRecord = {
  caseId: string;
  run: number;
  intent: Intent;
  latencyMs: number;
};

type Report = {
  startedAt: string;
  n: number;
  cases: IntentCase[];
  jev: JevRecord[];
  luna: LunaRecord[];
};

const { values } = parseArgs({
  options: {
    only: { type: "string", default: "all" },
    n: { type: "string", default: "3" },
    case: { type: "string" },
    concurrency: { type: "string", default: "4" },
    report: { type: "string" },
    out: {
      type: "string",
      default: resolve(serverRoot, "../eval-results/jev-intent"),
    },
  },
});

const JA_INSTRUCTIONS = `ユーザーのメッセージの意図を分類してください。迷ったら "thinking" に分類する。`;
const JA_CRITERIA = {
  casual:
    "挨拶、雑談、相槌、リアクション、感想、日常の報告など。情報検索が不要なもの",
  thinking: "質問、情報要求、事実確認など。検索や思考が必要なもの",
};
const jaIntentQuestion: JevQuestion = {
  type: "choice",
  instructions: JA_INSTRUCTIONS,
  criteria: JA_CRITERIA,
};

const intentQuestion: JevQuestion = {
  type: "choice",
  instructions:
    "Classify the intent of the user's latest message. When in doubt, choose thinking.",
  criteria: {
    casual:
      "Greeting, small talk, acknowledgement, reaction, sharing feelings or daily events. No information lookup is needed.",
    thinking:
      "A question, information request, or fact check that needs search or reasoning to answer.",
  },
};

const jaLatestIntentQuestion: JevQuestion = {
  type: "choice",
  instructions:
    "ユーザーの最新のメッセージの意図を分類する。迷ったら thinking にする。",
  criteria: {
    casual:
      "挨拶、雑談、相槌、リアクション、気持ちや日常の出来事の共有。情報を調べる必要がない。",
    thinking: "検索や推論が必要な質問、情報の依頼、事実確認。",
  },
};

const buildIntentState = (input: {
  text: string;
  previousAssistant?: string;
}) => [
  ...(input.previousAssistant
    ? [{ from: "assistant", text: input.previousAssistant }]
    : []),
  { from: "user", text: input.text },
];

const buildInput = (variant: Variant, c: IntentCase) => {
  const question =
    variant === "A"
      ? jaIntentQuestion
      : variant === "D"
        ? jaLatestIntentQuestion
        : intentQuestion;
  const state =
    variant === "C" || variant === "D"
      ? buildIntentState({
          text: c.text,
          previousAssistant: c.previousAssistant,
        })
      : c.text;
  return { state, questions: { intent: question } };
};

const RETRY_STATUSES = new Set([429, 529]);

const askJevWithRetry = async (params: Parameters<typeof askJev>[0]) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await askJev(params);
    } catch (error) {
      const retryable =
        error instanceof JevHttpError && RETRY_STATUSES.has(error.status);
      if (!retryable || attempt >= 3) throw error;
      await sleep(500 * 2 ** attempt);
    }
  }
};

const callJev = async (
  apiKey: string,
  variant: Variant,
  c: IntentCase,
  run: number,
): Promise<JevRecord> => {
  const started = performance.now();
  const base = { caseId: c.id, variant, run };
  const failed = (error: unknown): JevRecord => ({
    ...base,
    model: null,
    choice: null,
    pThinking: null,
    confidence: null,
    inputTokens: null,
    latencyMs: performance.now() - started,
    error: String(error),
  });
  try {
    const response = await askJevWithRetry({
      apiKey,
      ...buildInput(variant, c),
    });
    const latencyMs = performance.now() - started;
    const answer = response.answers.intent;
    if (answer?.type !== "choice") {
      return failed(`unexpected answer: ${JSON.stringify(answer)}`);
    }
    return {
      ...base,
      model: response.model ?? JEV_MODEL,
      choice: (answer.choice as Intent) ?? null,
      pThinking: answer.probabilities.thinking ?? null,
      confidence: answer.confidence ?? null,
      inputTokens: response.usage?.input_tokens ?? null,
      latencyMs,
    };
  } catch (error) {
    return failed(error);
  }
};

const callLuna = async (c: IntentCase, run: number) => {
  const started = performance.now();
  const intent = await classifyIntent({ text: c.text });
  return { caseId: c.id, run, intent, latencyMs: performance.now() - started };
};

const runPool = async <T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
) => {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (item !== undefined) await fn(item);
      }
    }),
  );
};

const percentile = (xs: number[], p: number) => {
  if (xs.length === 0) return Number.NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
};

const pct = (x: number) => (Number.isNaN(x) ? "-" : `${(x * 100).toFixed(1)}%`);
const ms = (x: number) => (Number.isNaN(x) ? "-" : `${Math.round(x)}ms`);

type Decision = { caseId: string; run: number; predicted: Intent };

const hasProbability = (r: JevRecord): r is JevRecord & { pThinking: number } =>
  r.pThinking !== null;

const scoreDecisions = (
  cases: IntentCase[],
  decisions: Decision[],
  n: number,
) => {
  const byId = new Map(cases.map((c) => [c.id, c]));
  let tp = 0;
  let fn = 0;
  let tpNoFrag = 0;
  let fnNoFrag = 0;
  let predCasual = 0;
  let predCasualCorrect = 0;
  let correct = 0;
  for (const d of decisions) {
    const c = byId.get(d.caseId);
    const exp = c?.expected;
    if (exp === "thinking") {
      const hit = d.predicted === "thinking";
      if (hit) tp++;
      else fn++;
      if (c?.tag !== "fragment") {
        if (hit) tpNoFrag++;
        else fnNoFrag++;
      }
    }
    if (d.predicted === "casual") {
      predCasual++;
      if (exp === "casual") predCasualCorrect++;
    }
    if (d.predicted === exp) correct++;
  }
  const byCase = new Map<string, Intent[]>();
  for (const d of decisions) {
    const runs = byCase.get(d.caseId) ?? [];
    runs.push(d.predicted);
    byCase.set(d.caseId, runs);
  }
  const stable = [...byCase.values()].filter(
    (runs) => runs.length === n && new Set(runs).size === 1,
  ).length;
  return {
    thinkingRecall: tp + fn === 0 ? Number.NaN : tp / (tp + fn),
    thinkingRecallNoFragment:
      tpNoFrag + fnNoFrag === 0 ? Number.NaN : tpNoFrag / (tpNoFrag + fnNoFrag),
    casualPrecision:
      predCasual === 0 ? Number.NaN : predCasualCorrect / predCasual,
    accuracy: decisions.length === 0 ? Number.NaN : correct / decisions.length,
    determinism: byCase.size === 0 ? Number.NaN : stable / byCase.size,
  };
};

const printSummary = (report: Report) => {
  const { cases } = report;
  const lines: string[] = [];
  if (report.luna.length > 0) {
    const s = scoreDecisions(
      cases,
      report.luna.map((r) => ({
        caseId: r.caseId,
        run: r.run,
        predicted: r.intent,
      })),
      report.n,
    );
    const lat = report.luna.map((r) => r.latencyMs);
    lines.push("## luna baseline (classifyIntent)");
    lines.push(
      "| thinking recall | recall excl. fragment | casual precision | accuracy | determinism | p50 | p95 |",
    );
    lines.push("|---|---|---|---|---|---|---|");
    lines.push(
      `| ${pct(s.thinkingRecall)} | ${pct(s.thinkingRecallNoFragment)} | ${pct(s.casualPrecision)} | ${pct(s.accuracy)} | ${pct(s.determinism)} | ${ms(percentile(lat, 0.5))} | ${ms(percentile(lat, 0.95))} |`,
    );
    lines.push("");
  }
  for (const variant of VARIANTS) {
    const records = report.jev.filter((r) => r.variant === variant);
    if (records.length === 0) continue;
    const ok = records.filter(hasProbability);
    const errors = records.length - ok.length;
    const lat = ok.map((r) => r.latencyMs);
    const tokens = ok.flatMap((r) =>
      r.inputTokens === null ? [] : [r.inputTokens],
    );
    const models = [...new Set(ok.map((r) => r.model))].join(",");
    lines.push(
      `## jev variant ${variant} (model ${models || "-"}, calls ${records.length}, errors ${errors}; ok calls only: p50 ${ms(percentile(lat, 0.5))}, p95 ${ms(percentile(lat, 0.95))}, mean input_tokens ${tokens.length ? Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length) : "-"})`,
    );
    lines.push(
      "| t | thinking recall | recall excl. fragment | casual precision | accuracy | determinism |",
    );
    lines.push("|---|---|---|---|---|---|");
    for (const t of THRESHOLDS) {
      const s = scoreDecisions(
        cases,
        ok.map((r) => ({
          caseId: r.caseId,
          run: r.run,
          predicted: r.pThinking >= t ? "thinking" : "casual",
        })),
        report.n,
      );
      lines.push(
        `| ${t.toFixed(2)} | ${pct(s.thinkingRecall)} | ${pct(s.thinkingRecallNoFragment)} | ${pct(s.casualPrecision)} | ${pct(s.accuracy)} | ${pct(s.determinism)} |`,
      );
    }
    lines.push("");
  }
  console.log(lines.join("\n"));
};

const printMisses = (report: Report) => {
  const expected = new Map(report.cases.map((c) => [c.id, c.expected]));
  const lunaMiss = report.luna.filter(
    (r) => r.intent !== expected.get(r.caseId),
  );
  if (lunaMiss.length > 0) {
    console.log("## luna misses");
    for (const r of lunaMiss)
      console.log(`- ${r.caseId} run${r.run}: ${r.intent}`);
    console.log("");
  }
  for (const variant of VARIANTS) {
    const misses = report.jev
      .filter(hasProbability)
      .filter(
        (r) => r.variant === variant && r.choice !== expected.get(r.caseId),
      );
    if (misses.length === 0) continue;
    console.log(`## jev ${variant} misses (argmax choice)`);
    for (const r of misses) {
      console.log(
        `- ${r.caseId} run${r.run}: ${r.choice} p(thinking)=${r.pThinking.toFixed(3)} conf=${(r.confidence ?? 0).toFixed(3)}`,
      );
    }
    console.log("");
  }
};

const main = async () => {
  if (values.report) {
    const report: Report = JSON.parse(readFileSync(values.report, "utf8"));
    printSummary(report);
    printMisses(report);
    return;
  }

  loadDevVars();
  const n = Number(values.n);
  const concurrency = Number(values.concurrency);
  const cases = values.case
    ? intentCases.filter((c) => c.id === values.case)
    : intentCases;
  const runJev = values.only === "all" || values.only === "jev";
  const runLuna = values.only === "all" || values.only === "luna";
  const report: Report = {
    startedAt: new Date().toISOString(),
    n,
    cases,
    jev: [],
    luna: [],
  };

  if (runJev) {
    const apiKey = process.env.TYPESAFE_API_KEY;
    if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set in .dev.vars");
    const jobs = VARIANTS.flatMap((variant) =>
      cases.flatMap((c) =>
        Array.from({ length: n }, (_, i) => ({ variant, c, run: i + 1 })),
      ),
    );
    let done = 0;
    await runPool(jobs, concurrency, async (job) => {
      const rec = await callJev(apiKey, job.variant, job.c, job.run);
      report.jev.push(rec);
      done++;
      if (rec.error)
        console.error(`[jev ${job.variant} ${job.c.id}] ${rec.error}`);
      if (done % 50 === 0) console.error(`jev ${done}/${jobs.length}`);
    });
  }

  if (runLuna) {
    if (!process.env.OPENAI_API_KEY)
      throw new Error("OPENAI_API_KEY is not set");
    const jobs = cases.flatMap((c) =>
      Array.from({ length: n }, (_, i) => ({ c, run: i + 1 })),
    );
    let done = 0;
    await runPool(jobs, concurrency, async (job) => {
      report.luna.push(await callLuna(job.c, job.run));
      done++;
      if (done % 50 === 0) console.error(`luna ${done}/${jobs.length}`);
    });
  }

  mkdirSync(values.out, { recursive: true });
  const file = join(
    values.out,
    `${report.startedAt.replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(file, JSON.stringify(report, null, 2));
  printSummary(report);
  printMisses(report);
  console.log(`saved: ${file}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
