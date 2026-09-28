import { AsyncLocalStorage } from "node:async_hooks";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { RequestContext } from "@mastra/core/request-context";
import { getPlatformProxy } from "wrangler";
import { askJev, type JevQuestion } from "../src/lib/jev";
import { resolveModelTier } from "../src/lib/llm-models";
import { createKnowledgeAgent } from "../src/mastra/agents/knowledge-agent";
import { createNeppChanAgent } from "../src/mastra/agents/nepp-chan-agent";
import { webResearcherAgent } from "../src/mastra/agents/web-researcher-agent";
import { loadDevVars, serverRoot } from "../src/mastra/evals/neppchan/dev-vars";
import { latencyQuestions } from "./data/latency-questions";

const ACCOUNT_ID = "51544998e04526c4d6cc9e3e08653361";
const VECTORIZE_INDEX = "nepp-chan-knowledge-dev";
const VILLAGE_THRESHOLD = 0.3;

const routeQuestion: JevQuestion = {
  type: "choice",
  instructions:
    "The assistant is the mascot of Otoineppu, a small village in Hokkaido, Japan, and answers from the village's own documents or from a web search. Decide what the assistant must look up to answer the user's latest message.",
  criteria: {
    none: "Nothing to look up: greetings, small talk, feelings, rephrasing or organizing what the user already said, or a request the assistant cannot carry out.",
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

type Call = { category: string; startMs: number; endMs: number };

const HOSTS: [string, string][] = [
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
  const category = HOSTS.find(([h]) => url.includes(h))?.[1] ?? "other";
  const startMs = performance.now() - store.startedAt;
  try {
    return await originalFetch(input, init);
  } finally {
    store.calls.push({
      category,
      startMs,
      endMs: performance.now() - store.startedAt,
    });
  }
};

type Coverage = "取れた" | "一部" | "取れない";

type Sample = {
  question: string;
  run: number;
  route: string;
  coverage?: Coverage;
  jevMs: number;
  knowledgeMs?: number;
  webMs?: number;
  writeFirstMs?: number;
  prefaceFirstMs?: number;
  prefaceDoneMs?: number;
  preface?: string;
  calls?: Call[];
  writeMs: number;
  totalMs: number;
  text: string;
  error?: string;
};

const { values } = parseArgs({
  options: {
    label: { type: "string", default: "workflow" },
    n: { type: "string", default: "2" },
  },
});

const outDir = resolve(serverRoot, "../eval-results/chat-latency");

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

const parseCoverage = (memo: string): Coverage => {
  const m = memo.match(/判定[:：]\s*(取れた|一部|取れない)/);
  return (m?.[1] as Coverage | undefined) ?? "一部";
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

const main = async () => {
  loadDevVars();
  const jevKey = process.env.TYPESAFE_API_KEY;
  if (!jevKey) throw new Error("TYPESAFE_API_KEY is not set");
  const { env, dispose } = await getPlatformProxy<CloudflareBindings>({
    configPath: "wrangler.jsonc",
    environment: "local",
    remoteBindings: false,
  });
  const benchEnv = {
    ...env,
    VECTORIZE: restVectorize(),
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    TYPESAFE_API_KEY: jevKey,
  };
  const knowledgeAgent = createKnowledgeAgent();
  const tier = resolveModelTier({
    intent: "thinking",
    platform: "web",
    isAdmin: false,
  });
  const writer = createNeppChanAgent({
    platform: "web",
    intent: "thinking",
    withMemory: false,
    modelConfig: tier,
    agents: {},
  });
  const prefacer = createNeppChanAgent({
    platform: "web",
    intent: "casual",
    withMemory: false,
    modelConfig: resolveModelTier({
      intent: "casual",
      platform: "web",
      isAdmin: false,
    }),
    agents: {},
  });

  const writePreface = async (question: string, startedAt: number) => {
    const stream = await prefacer.stream([
      {
        role: "system" as const,
        content:
          "いまは検索前の応答だけを書く。ユーザーの発言にある具体的な一要素に反応し、これから調べることを伝える 1〜2 文。事実や答えは書かない。",
      },
      { role: "user" as const, content: question },
    ]);
    let text = "";
    let firstMs: number | undefined;
    for await (const delta of stream.textStream) {
      firstMs ??= performance.now() - startedAt;
      text += delta;
    }
    return { text, firstMs, doneMs: performance.now() - startedAt };
  };

  const samples: Sample[] = [];
  try {
    for (let run = 1; run <= Number(values.n); run++) {
      for (const question of latencyQuestions) {
        const requestContext = new RequestContext();
        requestContext.set("env", benchEnv);
        requestContext.set("db", env.DB);
        const started = performance.now();
        const calls: Call[] = [];
        const sample: Sample = {
          question,
          run,
          route: "",
          jevMs: 0,
          writeMs: 0,
          totalMs: 0,
          text: "",
        };
        await callLog.run({ startedAt: started, calls }, async () => {
          try {
            const jev = await askJev({
              apiKey: jevKey,
              state: [{ from: "user", text: question }],
              questions: { route: routeQuestion },
            });
            sample.jevMs = performance.now() - started;
            const route = jev.answers.route;
            const pVillage =
              route?.type === "choice" ? (route.probabilities.village ?? 0) : 0;
            sample.route =
              pVillage >= VILLAGE_THRESHOLD
                ? "village"
                : route?.type === "choice"
                  ? route.choice
                  : "none";

            const preface =
              sample.route === "none"
                ? undefined
                : writePreface(question, started);
            const memos: string[] = [];
            if (sample.route === "village") {
              const t = performance.now();
              const res = await knowledgeAgent.generate(
                `ユーザーの質問: ${question}\n${COVERAGE_RULE}`,
                { requestContext },
              );
              sample.knowledgeMs = performance.now() - t;
              sample.coverage = parseCoverage(res.text);
              memos.push(`### 村のナレッジ\n${res.text}`);
            }
            if (
              sample.route === "outside" ||
              (sample.route === "village" && sample.coverage !== "取れた")
            ) {
              const t = performance.now();
              const res = await webResearcherAgent.generate(
                memos.length > 0
                  ? `ユーザーの質問: ${question}\n\n村のナレッジで確認できた内容:\n${memos[0]}\n\n不足している点だけを調べる。`
                  : `ユーザーの質問: ${question}`,
                { requestContext },
              );
              sample.webMs = performance.now() - t;
              memos.push(`### Web 検索\n${res.text}`);
            }

            const prefaced = await preface;
            sample.preface = prefaced?.text;
            sample.prefaceFirstMs = prefaced?.firstMs;
            sample.prefaceDoneMs = prefaced?.doneMs;
            const t = performance.now();
            const stream = await writer.stream(
              [
                ...(prefaced
                  ? [
                      {
                        role: "system" as const,
                        content: `ユーザーにはすでに「${prefaced.text}」と伝えてある。同じ反応や前置きを繰り返さず、本題から書く。`,
                      },
                    ]
                  : []),
                ...(memos.length > 0
                  ? [
                      {
                        role: "system" as const,
                        content: `## 調査メモ\n${memos.join("\n\n")}\n\nこの調査メモを根拠に回答する。追加の調べ物はしない。`,
                      },
                    ]
                  : []),
                { role: "user" as const, content: question },
              ],
              { requestContext },
            );
            for await (const delta of stream.textStream) {
              sample.writeFirstMs ??= performance.now() - t;
              sample.text += delta;
            }
            sample.writeMs = performance.now() - t;
          } catch (error) {
            sample.error = String(error);
          }
        });
        sample.totalMs = performance.now() - started;
        sample.calls = calls;
        samples.push(sample);
        console.error(
          `${run} ${sec(sample.totalMs)} first ${sec(sample.prefaceFirstMs ?? Number.NaN)} ${sample.route}/${sample.coverage ?? "-"} jev ${sec(sample.jevMs)} kn ${sec(sample.knowledgeMs ?? Number.NaN)} web ${sec(sample.webMs ?? Number.NaN)} write ${sec(sample.writeMs)} ${question}${sample.error ? ` ${sample.error}` : ""}`,
        );
      }
    }
  } finally {
    await dispose();
  }

  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${values.label}-${Date.now()}.json`);
  writeFileSync(
    file,
    JSON.stringify({ label: values.label, samples }, null, 2),
  );
  const ok = samples.filter((s) => !s.error);
  const total = ok.map((s) => s.totalMs);
  console.log(
    "| label | samples | total mean | total p50 | total p90 | first text p50 | jev p50 | knowledge p50 | web runs | write p50 | chars mean | errors |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
  console.log(
    `| ${values.label} | ${ok.length} | ${sec(mean(total))} | ${sec(percentile(total, 0.5))} | ${sec(percentile(total, 0.9))} | ${sec(
      percentile(
        ok.flatMap((s) =>
          s.prefaceFirstMs === undefined ? [] : [s.prefaceFirstMs],
        ),
        0.5,
      ),
    )} | ${sec(
      percentile(
        ok.map((s) => s.jevMs),
        0.5,
      ),
    )} | ${sec(
      percentile(
        ok.flatMap((s) => (s.knowledgeMs === undefined ? [] : [s.knowledgeMs])),
        0.5,
      ),
    )} | ${ok.filter((s) => s.webMs !== undefined).length} | ${sec(
      percentile(
        ok.map((s) => s.writeMs),
        0.5,
      ),
    )} | ${Math.round(mean(ok.map((s) => s.text.length)))} | ${samples.length - ok.length} |`,
  );
  console.log(`saved: ${file}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
