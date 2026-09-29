import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { serverRoot } from "../src/mastra/evals/neppchan/dev-vars";
import { latencyQuestions as QUESTIONS } from "./data/latency-questions";

type Phases = {
  delegateStartMs?: number;
  delegateEndMs?: number;
  answerStartMs?: number;
};

type Sample = {
  question: string;
  run: number;
  phases?: Phases;
  text?: string;
  memo?: string;
  firstTextMs: number | null;
  totalMs: number;
  chars: number;
  error?: string;
};

const { values } = parseArgs({
  options: {
    label: { type: "string", default: "run" },
    base: { type: "string", default: "http://localhost:8787" },
    n: { type: "string", default: "2" },
    compare: { type: "string", multiple: true },
  },
});

const outDir = resolve(serverRoot, "../eval-results/chat-latency");

const post = (path: string, token: string | undefined, body: unknown) =>
  fetch(`${values.base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

const ask = async (token: string, question: string, run: number) => {
  const thread = (await (await post("/threads", token, {})).json()) as {
    id: string;
  };
  const started = performance.now();
  const res = await post(`/threads/${thread.id}/chat`, token, {
    message: {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: question }],
    },
  });
  if (!res.ok || !res.body) {
    return {
      question,
      run,
      firstTextMs: null,
      totalMs: performance.now() - started,
      chars: 0,
      error: `status ${res.status}`,
    };
  }
  let firstTextMs: number | null = null;
  let chars = 0;
  const phases: Phases = {};
  let text = "";
  let memo: string | undefined;
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: {")) continue;
      const event = JSON.parse(line.slice(6)) as {
        type: string;
        delta?: string;
        output?: { memo?: string };
      };
      const at = performance.now() - started;
      if (event.type === "text-delta") {
        firstTextMs ??= at;
        if (phases.delegateEndMs !== undefined) phases.answerStartMs ??= at;
        chars += event.delta?.length ?? 0;
        text += event.delta ?? "";
      } else if (event.type === "tool-input-available") {
        phases.delegateStartMs ??= at;
      } else if (event.type === "tool-output-available") {
        phases.delegateEndMs = at;
        memo = event.output?.memo ?? memo;
      }
    }
  }
  return {
    question,
    run,
    phases,
    text,
    memo,
    firstTextMs,
    totalMs: performance.now() - started,
    chars,
  };
};

const percentile = (xs: number[], p: number) => {
  if (xs.length === 0) return Number.NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
};

const mean = (xs: number[]) =>
  xs.length === 0 ? Number.NaN : xs.reduce((a, b) => a + b, 0) / xs.length;

const sec = (x: number) => `${(x / 1000).toFixed(1)}s`;

const summarize = (label: string, samples: Sample[]) => {
  const ok = samples.filter((s) => !s.error);
  const total = ok.map((s) => s.totalMs);
  const first = ok.flatMap((s) =>
    s.firstTextMs === null ? [] : [s.firstTextMs],
  );
  const delegated = ok.filter(
    (s) =>
      s.phases?.delegateStartMs !== undefined &&
      s.phases.delegateEndMs !== undefined &&
      s.phases.answerStartMs !== undefined,
  );
  const phase = (f: (p: Required<Phases>, s: Sample) => number) =>
    sec(
      percentile(
        delegated.map((s) => f(s.phases as Required<Phases>, s)),
        0.5,
      ),
    );
  console.log(
    `| ${label} | ${ok.length} | ${sec(mean(total))} | ${sec(percentile(total, 0.5))} | ${sec(percentile(total, 0.9))} | ${sec(percentile(first, 0.5))} | ${phase((p) => p.delegateStartMs)} | ${phase((p) => p.delegateEndMs - p.delegateStartMs)} | ${phase((p, s) => s.totalMs - p.delegateEndMs)} | ${Math.round(mean(ok.map((s) => s.chars)))} | ${samples.length - ok.length} |`,
  );
};

const header = () => {
  console.log(
    "| label | samples | total mean | total p50 | total p90 | first text p50 | until delegate p50 | delegate p50 | after delegate p50 | chars mean | errors |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|---|---|");
};

const main = async () => {
  if (values.compare) {
    header();
    for (const f of values.compare) {
      const r = JSON.parse(readFileSync(f, "utf8")) as {
        label: string;
        samples: Sample[];
      };
      summarize(r.label, r.samples);
    }
    return;
  }
  const { token } = (await (
    await post("/auth/anonymous-session", undefined, {})
  ).json()) as { token: string };
  const samples: Sample[] = [];
  for (let run = 1; run <= Number(values.n); run++) {
    for (const q of QUESTIONS) {
      const started = performance.now();
      const s = await ask(token, q, run).catch((error) => ({
        question: q,
        run,
        firstTextMs: null,
        totalMs: performance.now() - started,
        chars: 0,
        error: String(error),
      }));
      samples.push(s);
      console.error(
        `${run} ${sec(s.totalMs)} first ${s.firstTextMs === null ? "-" : sec(s.firstTextMs)} ${q}${s.error ? ` ${s.error}` : ""}`,
      );
    }
  }
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${values.label}-${Date.now()}.json`);
  writeFileSync(
    file,
    JSON.stringify({ label: values.label, samples }, null, 2),
  );
  header();
  summarize(values.label, samples);
  console.log(`saved: ${file}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
