import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { RequestContext } from "@mastra/core/request-context";
import { rerankWithScorer } from "@mastra/rag";
import { embed } from "ai";
import { askJev, JevHttpError, type JevQuestion } from "../src/lib/jev";
import { GEMINI_EMBEDDING } from "../src/lib/llm-models";
import { loadDevVars, serverRoot } from "../src/mastra/evals/neppchan/dev-vars";
import { createRerankScorer } from "../src/services/knowledge/rerank-scorer";
import { searchKnowledge } from "../src/services/knowledge/search";
import { EMBEDDING_DIMENSIONS } from "../src/services/knowledge/vector-store";
import { evalTestCases } from "./data/eval-test-cases";

const SEARCH_TOP_K = 10;
const RERANK_TOP_K = 5;
const RERANK_WEIGHTS = { semantic: 0.5, vector: 0.3, position: 0.2 };

const rerankQuestion: JevQuestion = {
  type: "noul",
  instructions:
    "Does the passage contain information that answers the user's query?",
  criteria: {
    true: "The passage states facts that directly answer the query or are a substantial part of the answer.",
    false:
      "The passage is off-topic, or only shares words or the general topic with the query without answering it.",
  },
};

type Chunk = {
  id: string;
  vectorScore: number;
  content: string;
  source: string;
  title?: string;
  section?: string;
  relevant: boolean;
};

type Candidates = {
  caseId: string;
  query: string;
  requiredKeywords: string[];
  chunks: Chunk[];
};

type Arm = "luna" | "jev";
const ARMS: Arm[] = ["luna", "jev"];

type ScoreRecord = {
  caseId: string;
  arm: Arm;
  run: number;
  scores: (number | null)[];
  wallMs: number;
  errors: string[];
  inputTokens: number[];
};

type Report = {
  startedAt: string;
  n: number;
  env: string;
  candidates: Candidates[];
  records: ScoreRecord[];
};

const outDir = resolve(serverRoot, "../eval-results/jev-rerank");
const candidatesPath = join(outDir, "candidates.json");

const { values } = parseArgs({
  options: {
    build: { type: "boolean", default: false },
    env: { type: "string", default: "development" },
    only: { type: "string", default: "all" },
    n: { type: "string", default: "3" },
    case: { type: "string" },
    concurrency: { type: "string", default: "3" },
    report: { type: "string" },
    bench: { type: "boolean", default: false },
    ineligible: { type: "boolean", default: false },
  },
});

const isRelevant = (keywords: string[], chunk: Omit<Chunk, "relevant">) => {
  const haystack = [chunk.title, chunk.section, chunk.content].join("\n");
  return keywords.every((k) => haystack.includes(k));
};

const VECTORIZE_INDEX: Record<string, string> = {
  local: "nepp-chan-knowledge-local",
  development: "nepp-chan-knowledge-dev",
  production: "nepp-chan-knowledge-prd",
};

type VectorizeMatches = {
  matches: { id: string; score: number; metadata?: Record<string, unknown> }[];
};

const queryVectorize = (index: string, vector: number[]) => {
  const { CLOUDFLARE_API_TOKEN: _devVarsToken, ...wranglerEnv } = process.env;
  const out = execFileSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "vectorize",
      "query",
      index,
      "--top-k",
      String(SEARCH_TOP_K),
      "--return-metadata",
      "all",
      "--vector",
      ...vector.map((v) => v.toFixed(10)),
    ],
    {
      cwd: serverRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: wranglerEnv,
    },
  );
  return JSON.parse(out.slice(out.indexOf("{"))) as VectorizeMatches;
};

const buildCandidates = async () => {
  const index = VECTORIZE_INDEX[values.env];
  if (!index) throw new Error(`unknown env: ${values.env}`);
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  const model = createGoogleGenerativeAI({ apiKey }).textEmbeddingModel(
    GEMINI_EMBEDDING,
  );
  const positives = evalTestCases.filter((c) => c.type === "positive");
  const all: Candidates[] = [];
  for (const c of positives) {
    const { embedding } = await embed({
      model,
      value: c.input,
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
          taskType: "RETRIEVAL_QUERY",
        },
      },
    });
    const res = queryVectorize(index, embedding);
    const chunks = res.matches.map((m) => {
      const md = (m.metadata ?? {}) as Record<string, unknown>;
      const base = {
        id: m.id,
        vectorScore: m.score,
        content: (md.content as string | undefined) ?? "",
        source: (md.source as string | undefined) ?? "unknown",
        title: md.title as string | undefined,
        section: md.section as string | undefined,
      };
      return { ...base, relevant: isRelevant(c.requiredKeywords, base) };
    });
    all.push({
      caseId: c.id,
      query: c.input,
      requiredKeywords: c.requiredKeywords,
      chunks,
    });
    console.error(
      `${c.id}: ${chunks.filter((ch) => ch.relevant).length}/${chunks.length} relevant`,
    );
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(candidatesPath, JSON.stringify(all, null, 2));
  console.log(`saved: ${candidatesPath}`);
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

const scoreWithJev = async (apiKey: string, query: string, text: string) => {
  const response = await askJevWithRetry({
    apiKey,
    state: { query, passage: text },
    questions: { relevant: rerankQuestion },
  });
  const answer = response.answers.relevant;
  if (answer?.type !== "noul") {
    throw new Error(`unexpected answer: ${JSON.stringify(answer)}`);
  }
  return { score: answer.noul, inputTokens: response.usage?.input_tokens };
};

const lunaScorer = createRerankScorer();

const scoreCase = async (
  arm: Arm,
  c: Candidates,
  run: number,
  jevKey: string | undefined,
) => {
  const errors: string[] = [];
  const inputTokens: number[] = [];
  const started = performance.now();
  const scores = await Promise.all(
    c.chunks.map(async (chunk) => {
      try {
        if (arm === "luna") {
          const s = await lunaScorer.getRelevanceScore(c.query, chunk.content);
          return Number.isNaN(s) ? null : s;
        }
        if (!jevKey) throw new Error("TYPESAFE_API_KEY is not set");
        const r = await scoreWithJev(jevKey, c.query, chunk.content);
        if (r.inputTokens !== undefined) inputTokens.push(r.inputTokens);
        return r.score;
      } catch (error) {
        errors.push(String(error));
        return null;
      }
    }),
  );
  return {
    caseId: c.caseId,
    arm,
    run,
    scores,
    wallMs: performance.now() - started,
    errors,
    inputTokens,
  };
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

const rankWithProductionWeights = async (
  c: Candidates,
  scores: (number | null)[],
) => {
  const byId = new Map(c.chunks.map((ch, i) => [ch.id, scores[i] ?? 0]));
  const ranked = await rerankWithScorer({
    results: c.chunks.map((ch) => ({
      id: ch.id,
      score: ch.vectorScore,
      metadata: { text: ch.id },
    })),
    query: c.query,
    scorer: {
      getRelevanceScore: async (_query: string, id: string) =>
        byId.get(id) ?? 0,
    },
    options: { topK: SEARCH_TOP_K, weights: RERANK_WEIGHTS },
  });
  return ranked.map((r) => r.result.id);
};

const rankBySemantic = (c: Candidates, scores: (number | null)[]) =>
  c.chunks
    .map((ch, i) => ({ id: ch.id, s: scores[i] ?? 0, i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.id);

const rankMetrics = (c: Candidates, order: string[]) => {
  const relevant = new Set(
    c.chunks.filter((ch) => ch.relevant).map((ch) => ch.id),
  );
  const top = order.slice(0, RERANK_TOP_K);
  const inTop = top.filter((id) => relevant.has(id)).length;
  const firstRank = order.findIndex((id) => relevant.has(id));
  return {
    recall: inTop / Math.min(relevant.size, RERANK_TOP_K),
    hit: inTop > 0 ? 1 : 0,
    mrr: firstRank < 0 ? 0 : 1 / (firstRank + 1),
    top,
  };
};

const mean = (xs: number[]) =>
  xs.length === 0 ? Number.NaN : xs.reduce((a, b) => a + b, 0) / xs.length;

const percentile = (xs: number[], p: number) => {
  if (xs.length === 0) return Number.NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
};

const ranks = (xs: number[]) => {
  const idx = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const r = new Array<number>(xs.length);
  for (let k = 0; k < idx.length; ) {
    let j = k;
    while (j + 1 < idx.length && idx[j + 1].x === idx[k].x) j++;
    for (let m = k; m <= j; m++) r[idx[m].i] = (k + j) / 2;
    k = j + 1;
  }
  return r;
};

const spearman = (a: number[], b: number[]) => {
  const ra = ranks(a);
  const rb = ranks(b);
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
};

const f3 = (x: number) => (Number.isNaN(x) ? "-" : x.toFixed(3));
const ms = (x: number) => (Number.isNaN(x) ? "-" : `${Math.round(x)}ms`);

const summarize = async (report: Report) => {
  const eligible = report.candidates.filter((c) =>
    c.chunks.some((ch) => ch.relevant),
  );
  const lines: string[] = [];
  lines.push(
    `cases ${report.candidates.length}, eligible (relevant chunk in top-${SEARCH_TOP_K}) ${eligible.length}, excluded ${report.candidates.length - eligible.length}: ${report.candidates
      .filter((c) => !eligible.includes(c))
      .map((c) => c.caseId)
      .join(", ")}`,
  );
  lines.push("");
  lines.push(
    "| arm | ranking | recall@5 | hit@5 | MRR | top-5 stable | wall p50 | wall p95 | errors | mean input_tokens |",
  );
  lines.push("|---|---|---|---|---|---|---|---|---|---|");

  const vec = eligible.map((c) =>
    rankMetrics(
      c,
      c.chunks.map((ch) => ch.id),
    ),
  );
  lines.push(
    `| vector only | - | ${f3(mean(vec.map((m) => m.recall)))} | ${f3(mean(vec.map((m) => m.hit)))} | ${f3(mean(vec.map((m) => m.mrr)))} | - | - | - | - | - |`,
  );

  for (const arm of ARMS) {
    const recs = report.records.filter(
      (r) => r.arm === arm && eligible.some((c) => c.caseId === r.caseId),
    );
    if (recs.length === 0) continue;
    const wall = recs.map((r) => r.wallMs);
    const errors = recs.reduce((a, r) => a + r.errors.length, 0);
    const tokens = recs.flatMap((r) => r.inputTokens);
    for (const mode of ["production", "semantic"] as const) {
      const metrics: ReturnType<typeof rankMetrics>[] = [];
      const topsByCase = new Map<string, string[]>();
      for (const r of recs) {
        const c = eligible.find((x) => x.caseId === r.caseId);
        if (!c) continue;
        const order =
          mode === "production"
            ? await rankWithProductionWeights(c, r.scores)
            : rankBySemantic(c, r.scores);
        const m = rankMetrics(c, order);
        metrics.push(m);
        const tops = topsByCase.get(c.caseId) ?? [];
        tops.push([...m.top].sort().join("|"));
        topsByCase.set(c.caseId, tops);
      }
      const stable = [...topsByCase.values()].filter(
        (t) => t.length === report.n && new Set(t).size === 1,
      ).length;
      lines.push(
        `| ${arm} | ${mode} | ${f3(mean(metrics.map((m) => m.recall)))} | ${f3(mean(metrics.map((m) => m.hit)))} | ${f3(mean(metrics.map((m) => m.mrr)))} | ${f3(stable / topsByCase.size)} | ${ms(percentile(wall, 0.5))} | ${ms(percentile(wall, 0.95))} | ${errors} | ${tokens.length ? Math.round(mean(tokens)) : "-"} |`,
      );
    }
  }

  const meanScores = (arm: Arm) => {
    const m = new Map<string, number[]>();
    for (const r of report.records.filter((x) => x.arm === arm)) {
      const c = report.candidates.find((x) => x.caseId === r.caseId);
      r.scores.forEach((s, i) => {
        if (s === null || !c) return;
        const key = `${c.caseId}#${c.chunks[i].id}`;
        m.set(key, [...(m.get(key) ?? []), s]);
      });
    }
    return new Map([...m].map(([k, v]) => [k, mean(v)]));
  };
  const luna = meanScores("luna");
  const jev = meanScores("jev");
  const keys = [...luna.keys()].filter((k) => jev.has(k));
  if (keys.length > 0) {
    lines.push("");
    lines.push(
      `Spearman(luna, jev) over ${keys.length} pairs: ${f3(
        spearman(
          keys.map((k) => luna.get(k) ?? 0),
          keys.map((k) => jev.get(k) ?? 0),
        ),
      )}`,
    );
  }

  const errorSamples = [
    ...new Set(report.records.flatMap((r) => r.errors)),
  ].slice(0, 5);
  if (errorSamples.length > 0) {
    lines.push("");
    lines.push("errors (sample):");
    for (const e of errorSamples) lines.push(`- ${e}`);
  }
  console.log(lines.join("\n"));
};

const cachedVectorize = (c: Candidates) =>
  ({
    query: async () => ({
      matches: c.chunks.map((ch) => ({
        id: ch.id,
        score: ch.vectorScore,
        metadata: {
          content: ch.content,
          source: ch.source,
          title: ch.title,
          section: ch.section,
        },
      })),
    }),
  }) as unknown as VectorizeIndex;

const bench = async (candidates: Candidates[], n: number) => {
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const jevKey = process.env.TYPESAFE_API_KEY;
  if (!googleKey || !jevKey) throw new Error("API keys are not set");
  const contextFor = (arm: Arm) => {
    const ctx = new RequestContext();
    ctx.set("env", { TYPESAFE_API_KEY: arm === "jev" ? jevKey : undefined });
    return ctx;
  };
  const times: Record<Arm, number[]> = { luna: [], jev: [] };
  const failures: Record<Arm, number> = { luna: 0, jev: 0 };
  let i = 0;
  for (let run = 0; run < n; run++) {
    for (const c of candidates) {
      const order: Arm[] = i++ % 2 === 0 ? ["luna", "jev"] : ["jev", "luna"];
      for (const arm of order) {
        const started = performance.now();
        const result = await searchKnowledge(
          c.query,
          cachedVectorize(c),
          googleKey,
          contextFor(arm),
        );
        if (result.error) {
          failures[arm]++;
          console.error(`${arm} ${c.caseId}: ${result.error}`);
          continue;
        }
        times[arm].push(performance.now() - started);
      }
    }
    console.error(`run ${run + 1}/${n} done`);
  }
  console.log(
    `searchKnowledge sequential, ${candidates.length} cases x ${n} runs (Vectorize replaced by cached top-${SEARCH_TOP_K})`,
  );
  console.log("| arm | mean | p50 | p90 | p95 | max | failed |");
  console.log("|---|---|---|---|---|---|---|");
  for (const arm of ARMS) {
    const t = times[arm];
    console.log(
      `| ${arm} | ${ms(mean(t))} | ${ms(percentile(t, 0.5))} | ${ms(percentile(t, 0.9))} | ${ms(percentile(t, 0.95))} | ${ms(Math.max(...t))} | ${failures[arm]} |`,
    );
  }
};

const main = async () => {
  loadDevVars();
  if (values.build) {
    await buildCandidates();
    return;
  }
  if (values.report) {
    await summarize(JSON.parse(readFileSync(values.report, "utf8")));
    return;
  }
  if (!existsSync(candidatesPath)) {
    throw new Error(`run with --build first: ${candidatesPath} is missing`);
  }
  const all: Candidates[] = JSON.parse(readFileSync(candidatesPath, "utf8"));
  const candidates = values.case
    ? all.filter((c) => c.caseId === values.case)
    : all.filter(
        (c) => c.chunks.some((ch) => ch.relevant) !== values.ineligible,
      );
  const n = Number(values.n);
  if (values.bench) {
    await bench(candidates, n);
    return;
  }
  const arms = ARMS.filter((a) => values.only === "all" || values.only === a);
  const report: Report = {
    startedAt: new Date().toISOString(),
    n,
    env: values.env,
    candidates: all,
    records: [],
  };
  const jevKey = process.env.TYPESAFE_API_KEY;
  const jobs = arms.flatMap((arm) =>
    candidates.flatMap((c) =>
      Array.from({ length: n }, (_, i) => ({ arm, c, run: i + 1 })),
    ),
  );
  let done = 0;
  await runPool(jobs, Number(values.concurrency), async (job) => {
    const rec = await scoreCase(job.arm, job.c, job.run, jevKey);
    report.records.push(rec);
    done++;
    if (rec.errors.length > 0)
      console.error(`[${job.arm} ${job.c.caseId}] ${rec.errors[0]}`);
    if (done % 20 === 0) console.error(`${done}/${jobs.length}`);
  });

  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${report.startedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  await summarize(report);
  console.log(`saved: ${file}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
