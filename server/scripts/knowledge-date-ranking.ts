#!/usr/bin/env tsx
// dev の Vectorize に対して、各質問で最新版の source が top5 に入るかを数える。
// pnpm knowledge:date-ranking [--case <id>] [--out <json>] [--rewritten]
// --rewritten は「今年」「最新」を現在の年・年度に置き換えた質問文で検索する

import * as fs from "node:fs";
import * as path from "node:path";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { RequestContext } from "@mastra/core/request-context";
import { embed } from "ai";
import { getPlatformProxy } from "wrangler";
import { GEMINI_EMBEDDING } from "../src/lib/llm-models";
import { searchKnowledge } from "../src/services/knowledge/search";
import { EMBEDDING_DIMENSIONS } from "../src/services/knowledge/vector-store";
import {
  type KnowledgeDateCase,
  knowledgeDateCases,
} from "./data/knowledge-date-cases";

const RAW_TOP_K = 50;
const HIT_TOP_N = 5;

type RawHit = {
  source: string;
  date?: string;
  dateType?: string;
  score: number;
};

type CaseResult = KnowledgeDateCase & {
  rawBestRank: number | null;
  raw: RawHit[];
  top: RawHit[];
  hit: boolean;
  error?: string;
};

const parseArgs = () => {
  const argv = process.argv.slice(2);
  const read = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    caseId: read("--case"),
    rewritten: argv.includes("--rewritten"),
    out:
      read("--out") ??
      path.join(
        "..",
        ".brain",
        "knowledge-date-ranking",
        `${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      ),
  };
};

const matchesExpected = (source: string, expected: string[]) =>
  expected.some((e) => source.endsWith(e));

const toRawHit = (m: VectorizeMatch): RawHit => ({
  source: String(m.metadata?.source ?? "unknown"),
  date: m.metadata?.date as string | undefined,
  dateType: m.metadata?.date_type as string | undefined,
  score: m.score,
});

const queryRaw = async (
  vectorize: VectorizeIndex,
  apiKey: string,
  question: string,
) => {
  const google = createGoogleGenerativeAI({ apiKey });
  const { embedding } = await embed({
    model: google.textEmbeddingModel(GEMINI_EMBEDDING),
    value: question,
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: "RETRIEVAL_QUERY",
      },
    },
  });
  const res = await vectorize.query(embedding, {
    topK: RAW_TOP_K,
    returnMetadata: "all",
  });
  return res.matches.map(toRawHit);
};

const runCase = async (
  c: KnowledgeDateCase,
  vectorize: VectorizeIndex,
  apiKey: string,
  requestContext: RequestContext,
  useRewritten: boolean,
): Promise<CaseResult> => {
  const question = (useRewritten && c.rewritten) || c.question;
  const raw = await queryRaw(vectorize, apiKey, question);
  const rawIndex = raw.findIndex((r) => matchesExpected(r.source, c.expected));
  const search = await searchKnowledge(
    question,
    vectorize,
    apiKey,
    requestContext,
  );
  const top = search.results.slice(0, HIT_TOP_N).map((r) => ({
    source: r.source,
    date: r.date,
    dateType: r.dateType,
    score: r.score,
  }));
  return {
    ...c,
    question,
    rawBestRank: rawIndex >= 0 ? rawIndex + 1 : null,
    raw,
    top,
    hit: top.some((r) => matchesExpected(r.source, c.expected)),
    error: search.error,
  };
};

const shortSource = (s: string) =>
  s.replace(/^official\//, "").replace("villotoinep/pdf/parsed/", "");

const printResult = (r: CaseResult) => {
  const mark = r.hit ? "✅" : "❌";
  console.log(
    `${mark} [${r.kind}] ${r.id} "${r.question}" raw#${r.rawBestRank ?? "-"}${r.error ? ` error=${r.error}` : ""}`,
  );
  for (const [i, t] of r.top.entries()) {
    const exp = matchesExpected(t.source, r.expected) ? "*" : " ";
    console.log(
      `   ${exp}${i + 1}. ${shortSource(t.source)} ${t.date ?? "-"}/${t.dateType ?? "-"} ${t.score.toFixed(3)}`,
    );
  }
};

const summarize = (results: CaseResult[]) => {
  const scored = results.filter((r) => r.kind !== "unfixable");
  const byKind = (kind: KnowledgeDateCase["kind"]) => {
    const rs = scored.filter((r) => r.kind === kind);
    return `${rs.filter((r) => r.hit).length}/${rs.length}`;
  };
  return {
    total: `${scored.filter((r) => r.hit).length}/${scored.length}`,
    latest: byKind("latest"),
    control: byKind("control"),
  };
};

const main = async () => {
  const args = parseArgs();
  const cases = args.caseId
    ? knowledgeDateCases.filter((c) => c.id === args.caseId)
    : knowledgeDateCases;
  if (cases.length === 0) {
    console.error(`case not found: ${args.caseId}`);
    process.exit(1);
  }

  const { env, dispose } = await getPlatformProxy<CloudflareBindings>({
    configPath: "wrangler.jsonc",
    environment: "development",
    remoteBindings: true,
  });
  const secrets = env as unknown as Record<string, string | undefined>;
  process.env.OPENAI_API_KEY = secrets.OPENAI_API_KEY;
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  const requestContext = new RequestContext();
  requestContext.set("env", env);

  const results: CaseResult[] = [];
  for (const c of cases) {
    const r = await runCase(
      c,
      env.VECTORIZE,
      apiKey,
      requestContext,
      args.rewritten,
    );
    printResult(r);
    results.push(r);
  }
  await dispose();

  const summary = summarize(results);
  console.log(
    `\nhit@${HIT_TOP_N}: total ${summary.total} / latest ${summary.latest} / control ${summary.control}`,
  );

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(
    args.out,
    JSON.stringify(
      { ranAt: new Date().toISOString(), summary, results },
      null,
      2,
    ),
  );
  console.log(`saved: ${args.out}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
