import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { RequestContext } from "@mastra/core/request-context";
import { getPlatformProxy } from "wrangler";
import { askJev, type JevQuestion } from "../src/lib/jev";
import { knowledgeAgent } from "../src/mastra/agents/knowledge-agent";
import { webResearcherAgent } from "../src/mastra/agents/web-researcher-agent";
import { loadDevVars, serverRoot } from "../src/mastra/evals/neppchan/dev-vars";
import { runResearch } from "../src/mastra/workflows/research-workflow";
import { searchKnowledge } from "../src/services/knowledge/search";
import { evalTestCases, type TestCaseV3 } from "./data/eval-test-cases";

const ACCOUNT_ID = "51544998e04526c4d6cc9e3e08653361";
const VECTORIZE_INDEX = "nepp-chan-knowledge-dev";
const VILLAGE_THRESHOLD = 0.3;

type Variant = "base" | "ab";

type Sample = {
  caseId: string;
  variant: Variant;
  totalMs: number;
  routeMs?: number;
  preSearchMs?: number;
  knowledgeMs?: number;
  webMs?: number;
  route?: string;
  coverage?: string;
  knowledgeSearches?: number;
  pass: boolean;
  memoChars: number;
  memo: string;
  error?: string;
};

const { values } = parseArgs({
  options: {
    variant: { type: "string", default: "all" },
    concurrency: { type: "string", default: "3" },
    case: { type: "string" },
    compare: { type: "string", multiple: true },
  },
});

const outDir = resolve(serverRoot, "../eval-results/research-variant");

const routeQuestion: JevQuestion = {
  type: "choice",
  instructions:
    "The assistant is the mascot of Otoineppu, a small village in Hokkaido, Japan, and answers from the village's own documents or from a web search. Decide where the answer to the user's question should be looked up.",
  criteria: {
    village:
      "Information about Otoineppu village itself: its facilities, shops, events, schools, administration, history, local rules, local bus schedules, or village announcements.",
    outside:
      "Current or outside information: weather, live traffic or train status, news and current events, or places and general facts outside the village.",
  },
};

const COVERAGE_RULE = `
調査メモの最後の行に、次のどれか 1 つだけを書く。
判定: 取れた（質問の中心に答える事実が揃っている）
判定: 一部（中心の一部だけ確認できた）
判定: 取れない（質問に答える事実が見つからない）`;

const MEMO_FORMAT = `
調査メモは、質問に答える事実の箇条書きと出典 URL だけにする。文章に整えず、1 項目 1 行、多くても 8 行。`;

const COVERAGE_LINE = /\n?\s*判定[:：]\s*(取れた|一部|取れない)[^\n]*\s*$/;

const wranglerToken = () => {
  const { CLOUDFLARE_API_TOKEN: _devVarsToken, ...env } = process.env;
  return execFileSync("pnpm", ["exec", "wrangler", "auth", "token"], {
    cwd: serverRoot,
    encoding: "utf8",
    env,
  })
    .trim()
    .split("\n")
    .at(-1);
};

const restVectorize = () => {
  let token = wranglerToken();
  const post = (body: string) =>
    fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
      },
    );
  return {
    query: async (
      vector: number[],
      options: { topK?: number; returnMetadata?: string },
    ) => {
      const body = JSON.stringify({
        vector,
        topK: options.topK,
        returnMetadata: options.returnMetadata,
      });
      let res = await post(body);
      if (res.status === 401) {
        token = wranglerToken();
        res = await post(body);
      }
      if (!res.ok) throw new Error(`vectorize ${res.status}`);
      return ((await res.json()) as { result: unknown }).result;
    },
  } as unknown as VectorizeIndex;
};

const passes = (c: TestCaseV3, memo: string) =>
  c.requiredKeywords.every((k) => memo.includes(k));

const runAb = async (
  question: string,
  requestContext: RequestContext,
  env: { VECTORIZE: VectorizeIndex; GOOGLE_GENERATIVE_AI_API_KEY: string },
  jevKey: string,
  sample: Sample,
) => {
  let t = performance.now();
  const jev = await askJev({
    apiKey: jevKey,
    state: [{ from: "user", text: question }],
    questions: { route: routeQuestion },
  });
  sample.routeMs = performance.now() - t;
  const answer = jev.answers.route;
  const pVillage =
    answer?.type === "choice" ? (answer.probabilities.village ?? 0) : 1;
  sample.route = pVillage >= VILLAGE_THRESHOLD ? "village" : "outside";

  let knowledgeMemo: string | undefined;
  if (sample.route === "village") {
    t = performance.now();
    const searched = await searchKnowledge(
      question,
      env.VECTORIZE,
      env.GOOGLE_GENERATIVE_AI_API_KEY,
      requestContext,
    );
    sample.preSearchMs = performance.now() - t;
    const results = searched.results
      .map(
        (r, i) =>
          `【${i + 1}】${[r.title, r.section].filter(Boolean).join(" / ")}${r.url ? ` (${r.url})` : ""}${r.date ? ` [${r.date} ${r.dateType ?? ""}]` : ""}\n${r.content}`,
      )
      .join("\n\n");
    t = performance.now();
    const res = await knowledgeAgent.generate(
      `ユーザーの質問: ${question}\n\n最初の検索結果:\n${results || "該当なし"}\n\n足りない情報だけ追加で検索してよい。\n${MEMO_FORMAT}\n${COVERAGE_RULE}`,
      { requestContext },
    );
    sample.knowledgeMs = performance.now() - t;
    sample.knowledgeSearches = res.steps
      .flatMap((s) => s.toolCalls)
      .filter((c) => c.payload.toolName === "knowledgeSearchTool").length;
    sample.coverage = res.text.match(COVERAGE_LINE)?.[1] ?? "一部";
    knowledgeMemo = res.text.replace(COVERAGE_LINE, "").trim();
  }

  let webMemo: string | undefined;
  if (sample.route === "outside" || sample.coverage !== "取れた") {
    t = performance.now();
    const res = await webResearcherAgent.generate(
      knowledgeMemo
        ? `ユーザーの質問: ${question}\n\n村のナレッジで確認できた内容:\n${knowledgeMemo}\n\n不足している点だけを調べる。`
        : `ユーザーの質問: ${question}`,
      { requestContext },
    );
    sample.webMs = performance.now() - t;
    webMemo = res.text;
  }
  return [
    knowledgeMemo ? `### 村のナレッジ\n${knowledgeMemo}` : "",
    webMemo ? `### Web 検索\n${webMemo}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
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

const mean = (xs: number[]) =>
  xs.length === 0 ? Number.NaN : xs.reduce((a, b) => a + b, 0) / xs.length;

const sec = (x: number) =>
  Number.isNaN(x) ? "-" : `${(x / 1000).toFixed(1)}s`;

const summarize = (samples: Sample[]) => {
  console.log(
    "| variant | cases | pass | total mean | p50 | p90 | knowledge p50 | web rate | web p50 | memo chars | errors |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const variant of ["base", "ab"] as const) {
    const all = samples.filter((s) => s.variant === variant);
    if (all.length === 0) continue;
    const ok = all.filter((s) => !s.error);
    const totalMs = ok.map((s) => s.totalMs);
    const knowledgeMs = ok.flatMap((s) =>
      s.knowledgeMs === undefined ? [] : [s.knowledgeMs],
    );
    const webMs = ok.flatMap((s) => (s.webMs === undefined ? [] : [s.webMs]));
    const webRuns = ok.filter((s) => s.memo.includes("### Web 検索")).length;
    const passRate = (ok.filter((s) => s.pass).length / ok.length) * 100;
    console.log(
      `| ${variant} | ${ok.length} | ${passRate.toFixed(1)}% | ${sec(mean(totalMs))} | ${sec(percentile(totalMs, 0.5))} | ${sec(percentile(totalMs, 0.9))} | ${sec(percentile(knowledgeMs, 0.5))} | ${((webRuns / ok.length) * 100).toFixed(0)}% | ${sec(percentile(webMs, 0.5))} | ${Math.round(mean(ok.map((s) => s.memoChars)))} | ${all.length - ok.length} |`,
    );
  }
};

const main = async () => {
  if (values.compare) {
    summarize(
      values.compare.flatMap(
        (f) =>
          (JSON.parse(readFileSync(f, "utf8")) as { samples: Sample[] })
            .samples,
      ),
    );
    return;
  }
  loadDevVars();
  const jevKey = process.env.TYPESAFE_API_KEY;
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!jevKey || !googleKey) throw new Error("API keys are not set");
  const { env, dispose } = await getPlatformProxy<CloudflareBindings>({
    configPath: "wrangler.jsonc",
    environment: "local",
    remoteBindings: false,
  });
  const benchEnv = {
    ...env,
    VECTORIZE: restVectorize(),
    GOOGLE_GENERATIVE_AI_API_KEY: googleKey,
    TYPESAFE_API_KEY: jevKey,
  };
  const cases = evalTestCases.filter((c) =>
    values.case ? c.id === values.case : c.type === "positive",
  );
  const variants: Variant[] =
    values.variant === "all" ? ["base", "ab"] : [values.variant as Variant];
  const jobs = cases.flatMap((c) =>
    variants.map((variant) => ({ c, variant })),
  );
  const samples: Sample[] = [];
  let done = 0;
  try {
    await runPool(jobs, Number(values.concurrency), async ({ c, variant }) => {
      const requestContext = new RequestContext();
      requestContext.set("env", benchEnv);
      requestContext.set("db", env.DB);
      const sample: Sample = {
        caseId: c.id,
        variant,
        totalMs: 0,
        pass: false,
        memoChars: 0,
        memo: "",
      };
      const started = performance.now();
      try {
        const memo =
          variant === "base"
            ? (await runResearch({ question: c.input, requestContext })).memo
            : await runAb(c.input, requestContext, benchEnv, jevKey, sample);
        sample.memo = memo;
        sample.memoChars = memo.length;
        sample.pass = passes(c, memo);
      } catch (error) {
        sample.error = String(error);
        console.error(`[${variant} ${c.id}] ${error}`);
      }
      sample.totalMs = performance.now() - started;
      samples.push(sample);
      done++;
      if (done % 20 === 0) console.error(`${done}/${jobs.length}`);
    });
  } finally {
    await dispose();
  }
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ samples }, null, 2));
  summarize(samples);
  console.log(`saved: ${file}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
