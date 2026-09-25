import { AsyncLocalStorage } from "node:async_hooks";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { RequestContext } from "@mastra/core/request-context";
import { getPlatformProxy } from "wrangler";
import type { ReasoningEffort } from "../src/lib/llm-models";
import { loadDevVars, serverRoot } from "../src/mastra/evals/neppchan/dev-vars";
import { evalTestCases, type TestCaseV3 } from "./data/eval-test-cases";

type Search = { query: string; hasKeywords: boolean };

type Step = { toolCalls: string[]; searches: Search[] };

type Category = "llm" | "embedding" | "vectorize" | "jev" | "other";

type Call = { category: Category; startMs: number; endMs: number };

type CaseRecord = {
  caseId: string;
  calls?: Call[];
  type: TestCaseV3["type"];
  wallMs: number;
  steps: Step[];
  searches: number;
  pass: boolean;
  memo: string;
  error?: string;
};

type Report = {
  label: string;
  startedAt: string;
  records: CaseRecord[];
};

const ACCOUNT_ID = "51544998e04526c4d6cc9e3e08653361";
const VECTORIZE_INDEX = "nepp-chan-knowledge-dev";
const outDir = resolve(serverRoot, "../eval-results/knowledge-agent-bench");

const { values } = parseArgs({
  options: {
    label: { type: "string", default: "run" },
    case: { type: "string" },
    type: { type: "string", default: "positive" },
    concurrency: { type: "string", default: "3" },
    compare: { type: "string", multiple: true },
    effort: { type: "string" },
  },
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

const HOST_CATEGORY: [string, Category][] = [
  ["api.openai.com", "llm"],
  ["generativelanguage.googleapis.com", "embedding"],
  ["api.cloudflare.com", "vectorize"],
  ["api.typesafe.ai", "jev"],
];

const callLog = new AsyncLocalStorage<{ startedAt: number; calls: Call[] }>();

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const store = callLog.getStore();
  if (!store) return originalFetch(input, init);
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const category =
    HOST_CATEGORY.find(([host]) => url.includes(host))?.[1] ?? "other";
  const startMs = performance.now() - store.startedAt;
  try {
    const res = await originalFetch(input, init);
    await res.clone().arrayBuffer();
    return res;
  } finally {
    store.calls.push({
      category,
      startMs,
      endMs: performance.now() - store.startedAt,
    });
  }
};

const unionMs = (calls: Call[]) => {
  const sorted = [...calls].sort((a, b) => a.startMs - b.startMs);
  let total = 0;
  let end = Number.NEGATIVE_INFINITY;
  for (const c of sorted) {
    if (c.startMs > end) {
      total += c.endMs - c.startMs;
      end = c.endMs;
    } else if (c.endMs > end) {
      total += c.endMs - end;
      end = c.endMs;
    }
  }
  return total;
};

const printBreakdown = (records: CaseRecord[]) => {
  const ok = records
    .filter((r) => !r.error && r.calls)
    .sort((a, b) => a.wallMs - b.wallMs);
  if (ok.length === 0) return;
  const buckets: [string, CaseRecord[]][] = [
    ["~p50", ok.slice(0, Math.ceil(ok.length * 0.5))],
    [
      "p50~p90",
      ok.slice(Math.ceil(ok.length * 0.5), Math.ceil(ok.length * 0.9)),
    ],
    ["p90~", ok.slice(Math.ceil(ok.length * 0.9))],
  ];
  const categories: Category[] = [
    "llm",
    "embedding",
    "vectorize",
    "jev",
    "other",
  ];
  console.log("");
  console.log(
    `| bucket | cases | wall | ${categories.join(" | ")} | untracked | llm calls | searches |`,
  );
  console.log(
    `|---|---|---|${categories.map(() => "---").join("|")}|---|---|---|`,
  );
  for (const [name, rs] of buckets) {
    const per = categories.map((cat) =>
      mean(
        rs.map((r) =>
          unionMs((r.calls ?? []).filter((c) => c.category === cat)),
        ),
      ),
    );
    const wall = mean(rs.map((r) => r.wallMs));
    const tracked = mean(rs.map((r) => unionMs(r.calls ?? [])));
    console.log(
      `| ${name} | ${rs.length} | ${Math.round(wall)}ms | ${per.map((x) => `${Math.round(x)}ms`).join(" | ")} | ${Math.round(wall - tracked)}ms | ${mean(rs.map((r) => (r.calls ?? []).filter((c) => c.category === "llm").length)).toFixed(2)} | ${mean(rs.map((r) => r.searches)).toFixed(2)} |`,
    );
  }
};

const passes = (c: TestCaseV3, memo: string) =>
  c.type === "positive"
    ? c.requiredKeywords.every((k) => memo.includes(k))
    : c.requiredKeywords.some((k) => memo.includes(k));

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

const summarize = (reports: Report[]) => {
  console.log(
    "| label | cases | pass | wall mean | wall p50 | wall p90 | steps mean | searches mean | search in step 1 | errors |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|---|");
  for (const r of reports) {
    const ok = r.records.filter((x) => !x.error);
    const wall = ok.map((x) => x.wallMs);
    const firstStepSearches = ok.map(
      (x) =>
        x.steps[0]?.toolCalls.filter((t) => t === "knowledgeSearchTool")
          .length ?? 0,
    );
    console.log(
      `| ${r.label} | ${ok.length} | ${((ok.filter((x) => x.pass).length / ok.length) * 100).toFixed(1)}% | ${Math.round(mean(wall))}ms | ${Math.round(percentile(wall, 0.5))}ms | ${Math.round(percentile(wall, 0.9))}ms | ${mean(ok.map((x) => x.steps.length)).toFixed(2)} | ${mean(ok.map((x) => x.searches)).toFixed(2)} | ${mean(firstStepSearches).toFixed(2)} | ${r.records.length - ok.length} |`,
    );
  }
  for (const r of reports) {
    if (reports.length > 1) console.log(`\n${r.label}`);
    printBreakdown(r.records);
  }
  if (reports.length === 2) {
    const [a, b] = reports;
    const byId = new Map(a.records.map((x) => [x.caseId, x]));
    const flips = b.records.flatMap((x) => {
      const prev = byId.get(x.caseId);
      if (!prev || prev.error || x.error || prev.pass === x.pass) return [];
      return [`${x.caseId}: ${prev.pass ? "pass→fail" : "fail→pass"}`];
    });
    if (flips.length > 0) {
      console.log("");
      console.log(`pass flips (${a.label} → ${b.label}):`);
      for (const f of flips) console.log(`- ${f}`);
    }
  }
};

const main = async () => {
  if (values.compare) {
    summarize(
      values.compare.map((f) => JSON.parse(readFileSync(f, "utf8")) as Report),
    );
    return;
  }

  loadDevVars();
  const { createKnowledgeAgent } = await import(
    "../src/mastra/agents/knowledge-agent"
  );
  const knowledgeAgent = createKnowledgeAgent({
    effort: values.effort as ReasoningEffort | undefined,
  });
  const { env, dispose } = await getPlatformProxy<CloudflareBindings>({
    configPath: "wrangler.jsonc",
    environment: "local",
    remoteBindings: false,
  });
  const benchEnv = {
    ...env,
    VECTORIZE: restVectorize(),
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY,
  };

  const cases = evalTestCases.filter((c) =>
    values.case ? c.id === values.case : c.type === values.type,
  );
  const report: Report = {
    label: values.label,
    startedAt: new Date().toISOString(),
    records: [],
  };

  let done = 0;
  try {
    await runPool(cases, Number(values.concurrency), async (c) => {
      const requestContext = new RequestContext();
      requestContext.set("env", benchEnv);
      requestContext.set("db", env.DB);
      const started = performance.now();
      const calls: Call[] = [];
      try {
        const result = await callLog.run({ startedAt: started, calls }, () =>
          knowledgeAgent.generate(c.input, { requestContext }),
        );
        const steps = result.steps.map((s) => ({
          toolCalls: s.toolCalls.map((t) => t.payload.toolName),
          searches: s.toolResults
            .filter((t) => t.payload.toolName === "knowledgeSearchTool")
            .map((t) => {
              const { args, result: output } = t.payload as {
                args: { query: string };
                result: {
                  results?: {
                    content: string;
                    title?: string;
                    section?: string;
                  }[];
                };
              };
              const text = (output.results ?? [])
                .map((r) => [r.title, r.section, r.content].join("\n"))
                .join("\n");
              return { query: args.query, hasKeywords: passes(c, text) };
            }),
        }));
        report.records.push({
          caseId: c.id,
          calls,
          type: c.type,
          wallMs: performance.now() - started,
          steps,
          searches: steps
            .flatMap((s) => s.toolCalls)
            .filter((t) => t === "knowledgeSearchTool").length,
          pass: passes(c, result.text),
          memo: result.text,
        });
      } catch (error) {
        report.records.push({
          caseId: c.id,
          type: c.type,
          wallMs: performance.now() - started,
          steps: [],
          searches: 0,
          pass: false,
          memo: "",
          error: String(error),
        });
        console.error(`[${c.id}] ${error}`);
      }
      done++;
      if (done % 10 === 0) console.error(`${done}/${cases.length}`);
    });
  } finally {
    await dispose();
  }

  mkdirSync(outDir, { recursive: true });
  const file = join(
    outDir,
    `${report.label}-${report.startedAt.replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(file, JSON.stringify(report, null, 2));
  summarize([report]);
  console.log(`saved: ${file}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
