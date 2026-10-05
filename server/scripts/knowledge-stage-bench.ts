import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { RequestContext } from "@mastra/core/request-context";
import { getPlatformProxy } from "wrangler";
import { z } from "zod";
import type { ReasoningEffort } from "../src/lib/llm-models";
import { createKnowledgeAgent } from "../src/mastra/agents/knowledge-agent";
import { loadDevVars, serverRoot } from "../src/mastra/evals/neppchan/dev-vars";
import { broadcastRepository } from "../src/repository/broadcast-repository";
import {
  type KnowledgeResult,
  searchKnowledge,
} from "../src/services/knowledge/search";
import { evalTestCases } from "./data/eval-test-cases";

const ACCOUNT_ID = "51544998e04526c4d6cc9e3e08653361";
const VECTORIZE_INDEX = "nepp-chan-knowledge-dev";
const BROADCAST_LIMIT = 5;

const VARIANTS = {
  base: { tools: true, effort: "low", broadcasts: false },
  single: { tools: false, effort: "low", broadcasts: true },
  none: { tools: true, effort: "none", broadcasts: false },
  "single-none": { tools: false, effort: "none", broadcasts: true },
} as const satisfies Record<
  string,
  { tools: boolean; effort: ReasoningEffort; broadcasts: boolean }
>;

type Variant = keyof typeof VARIANTS;

type Sample = {
  caseId: string;
  variant: Variant;
  run: number;
  preSearchMs: number;
  agentMs: number;
  coverage?: string;
  pass: boolean;
  extraSearches: number;
  broadcastSearches: number;
  steps: number;
  promptChars: number;
  memo: string;
  error?: string;
};

const { values } = parseArgs({
  options: {
    variant: { type: "string", default: "all" },
    n: { type: "string", default: "1" },
    concurrency: { type: "string", default: "4" },
    case: { type: "string" },
    compare: { type: "string", multiple: true },
  },
});

const outDir = resolve(serverRoot, "../eval-results/knowledge-stage");

const coverageSchema = z
  .enum(["取れた", "一部", "取れない"])
  .describe(
    "ユーザーの発言に答えられるか。取れた: 聞いていることの中心に答える事実が揃っている。一部: 中心に答える事実はあるが、細部が確認できない。取れない: 中心に答える事実が見つからない",
  );

const knowledgeOutputSchema = z.object({
  memo: z
    .string()
    .describe(
      "調査メモ。質問に答える事実の箇条書きと出典 URL だけにする。文章に整えず、1 項目 1 行、多くても 8 行",
    ),
  coverage: coverageSchema,
});

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

const renderSearchResults = (results: KnowledgeResult[]) =>
  results
    .map((r, i) => {
      const heading = [r.title, r.section].filter(Boolean).join(" / ");
      const url = r.url ? ` (${r.url})` : "";
      const date = r.date ? ` [${r.date} ${r.dateType ?? ""}]` : "";
      return `【${i + 1}】${heading}${url}${date}\n${r.content}`;
    })
    .join("\n\n");

const renderBroadcasts = (
  rows: { title: string; body: string; sentAt: string | null }[],
) =>
  rows
    .map((b, i) => `【配信${i + 1}】${b.title} [${b.sentAt ?? ""}]\n${b.body}`)
    .join("\n\n");

const toolCallCount = (
  steps: { toolCalls: { payload: { toolName: string } }[] }[],
  toolName: string,
) =>
  steps
    .flatMap((step) => step.toolCalls)
    .filter((call) => call.payload.toolName === toolName).length;

const agents = Object.fromEntries(
  (["low", "none"] as const).map((effort) => [
    effort,
    createKnowledgeAgent({ effort }),
  ]),
) as Record<"low" | "none", ReturnType<typeof createKnowledgeAgent>>;

const runStage = async (
  question: string,
  variant: Variant,
  env: {
    VECTORIZE: VectorizeIndex;
    GOOGLE_GENERATIVE_AI_API_KEY: string;
    DB: D1Database;
  },
  requestContext: RequestContext,
  sample: Sample,
) => {
  const config = VARIANTS[variant];
  const searchStartedAt = performance.now();
  const [search, broadcasts] = await Promise.all([
    searchKnowledge(
      question,
      env.VECTORIZE,
      env.GOOGLE_GENERATIVE_AI_API_KEY,
      requestContext,
    ),
    config.broadcasts
      ? broadcastRepository.findByKeyword(env.DB, question, BROADCAST_LIMIT)
      : Promise.resolve([]),
  ]);
  sample.preSearchMs = performance.now() - searchStartedAt;
  const searched = renderSearchResults(search.results) || "該当なし";
  const broadcastSection =
    broadcasts.length > 0
      ? `\n村の LINE 配信（新しい順）:\n${renderBroadcasts(broadcasts)}\n`
      : "";
  const guidance = config.tools
    ? "足りない情報だけ、検索済みの語と違う観点で追加検索してよい。"
    : "上の検索結果と配信だけから調査メモを書く。追加の検索はしない。";
  const prompt = `ユーザーの質問: ${question}\n最初の検索結果（検索語: ${question}）:\n${searched}\n${broadcastSection}\n${guidance}\n`;
  sample.promptChars = prompt.length;
  const agentStartedAt = performance.now();
  const res = await agents[config.effort].generate(prompt, {
    requestContext,
    structuredOutput: { schema: knowledgeOutputSchema },
    ...(config.tools ? {} : { toolChoice: "none" as const }),
  });
  sample.agentMs = performance.now() - agentStartedAt;
  const output = res.object ?? { memo: res.text, coverage: "取れない" };
  sample.coverage = output.coverage;
  sample.extraSearches = toolCallCount(res.steps, "knowledgeSearchTool");
  sample.broadcastSearches = toolCallCount(res.steps, "broadcastGetTool");
  sample.steps = res.steps.length;
  return output.memo;
};

const runPool = async <T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
) => {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await fn(item);
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

const sec = (x: number) => `${(x / 1000).toFixed(1)}s`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const summarize = (samples: Sample[]) => {
  console.log(
    "| variant | samples | pass | 取れた | 一部 | 取れない(→Web) | agent p50 | agent p90 | agent max | 追加検索あり | 配信検索あり | prompt chars | errors |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const variant of Object.keys(VARIANTS) as Variant[]) {
    const all = samples.filter((s) => s.variant === variant);
    if (all.length === 0) continue;
    const ok = all.filter((s) => !s.error);
    const rate = (f: (s: Sample) => boolean) =>
      pct(ok.filter(f).length / ok.length);
    const agent = ok.map((s) => s.agentMs);
    console.log(
      `| ${variant} | ${ok.length} | ${rate((s) => s.pass)} | ${rate((s) => s.coverage === "取れた")} | ${rate((s) => s.coverage === "一部")} | ${rate((s) => s.coverage === "取れない")} | ${sec(percentile(agent, 0.5))} | ${sec(percentile(agent, 0.9))} | ${sec(Math.max(...agent))} | ${rate((s) => s.extraSearches > 0)} | ${rate((s) => s.broadcastSearches > 0)} | ${Math.round(mean(ok.map((s) => s.promptChars)))} | ${all.length - ok.length} |`,
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
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const jevKey = process.env.TYPESAFE_API_KEY;
  if (!googleKey || !jevKey) throw new Error("API keys are not set");
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
  const variants =
    values.variant === "all"
      ? (Object.keys(VARIANTS) as Variant[])
      : (values.variant.split(",") as Variant[]);
  const jobs = Array.from(
    { length: Number(values.n) },
    (_, i) => i + 1,
  ).flatMap((run) =>
    cases.flatMap((c) => variants.map((variant) => ({ c, variant, run }))),
  );
  const samples: Sample[] = [];
  let done = 0;
  try {
    await runPool(
      jobs,
      Number(values.concurrency),
      async ({ c, variant, run }) => {
        const requestContext = new RequestContext();
        requestContext.set("env", benchEnv);
        requestContext.set("db", env.DB);
        const sample: Sample = {
          caseId: c.id,
          variant,
          run,
          preSearchMs: 0,
          agentMs: 0,
          pass: false,
          extraSearches: 0,
          broadcastSearches: 0,
          steps: 0,
          promptChars: 0,
          memo: "",
        };
        try {
          sample.memo = await runStage(
            c.input,
            variant,
            benchEnv,
            requestContext,
            sample,
          );
          sample.pass = c.requiredKeywords.every((k) =>
            sample.memo.includes(k),
          );
        } catch (error) {
          sample.error = String(error);
          console.error(`[${variant} ${c.id}] ${error}`);
        }
        samples.push(sample);
        done++;
        if (done % 20 === 0) console.error(`${done}/${jobs.length}`);
      },
    );
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
