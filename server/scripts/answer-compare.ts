import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { loadDevVars } from "../src/mastra/evals/neppchan/dev-vars";
import { evalTestCases } from "./data/eval-test-cases";

type Verdict = "accuracy" | "helpfulness" | "persona" | "overall";

type Row = {
  question: string;
  run: number;
  keyword: Record<string, boolean | undefined>;
  reason: string;
} & Record<Verdict, string>;

type Sample = { question: string; run: number; text?: string; error?: string };

const { values } = parseArgs({
  options: {
    a: { type: "string" },
    b: { type: "string" },
    out: { type: "string" },
  },
});

const judgeSchema = z.object({
  accuracy: z.enum(["A", "B", "tie"]),
  helpfulness: z.enum(["A", "B", "tie"]),
  persona: z.enum(["A", "B", "tie"]),
  overall: z.enum(["A", "B", "tie"]),
  reason: z.string(),
});

const JUDGE_PROMPT = `あなたは音威子府村のマスコット「ねっぷちゃん」の回答を比べる審査員です。
同じ質問への回答 1 と回答 2 を、次の観点でそれぞれどちらが良いか判定してください。差がなければ tie。
- accuracy: 事実の正しさ。参考情報があればそれと食い違わないか。根拠のない断定や作り話がないか
- helpfulness: 質問にすぐ答えているか、相手が次に動ける情報があるか。不要に長くないか
- persona: 親しみやすいねっぷちゃんらしい語り口か
- overall: 総合してどちらを村の人に返したいか
回答の長さそのものでは評価しない。`;

const load = (path: string) =>
  JSON.parse(readFileSync(path, "utf8")) as {
    label: string;
    samples: Sample[];
  };

const keywordPass = (question: string, text: string) => {
  const c = evalTestCases.find((x) => x.input === question);
  if (!c) return undefined;
  return c.type === "positive"
    ? c.requiredKeywords.every((k) => text.includes(k))
    : c.requiredKeywords.some((k) => text.includes(k));
};

const main = async () => {
  if (!values.a || !values.b)
    throw new Error("--a と --b に結果 JSON を指定する");
  loadDevVars();
  const a = load(values.a);
  const b = load(values.b);
  const rows: Row[] = [];
  for (const sa of a.samples) {
    const sb = b.samples.find(
      (x) => x.question === sa.question && x.run === sa.run,
    );
    if (!sb || !sa.text || !sb.text || sa.error || sb.error) continue;
    const swap = Math.random() < 0.5;
    const [first, second] = swap ? [sb.text, sa.text] : [sa.text, sb.text];
    const truth = evalTestCases.find(
      (x) => x.input === sa.question,
    )?.groundTruth;
    const { object } = await generateObject({
      model: openai("gpt-5.6-terra"),
      schema: judgeSchema,
      system: JUDGE_PROMPT,
      prompt: `質問: ${sa.question}\n${truth ? `参考情報: ${truth}\n` : ""}\n回答 1:\n${first}\n\n回答 2:\n${second}`,
    });
    const unswap = (v: "A" | "B" | "tie") =>
      v === "tie" ? "tie" : (v === "A") !== swap ? a.label : b.label;
    const row = {
      question: sa.question,
      run: sa.run,
      keyword: {
        [a.label]: keywordPass(sa.question, sa.text),
        [b.label]: keywordPass(sa.question, sb.text),
      },
      accuracy: unswap(object.accuracy),
      helpfulness: unswap(object.helpfulness),
      persona: unswap(object.persona),
      overall: unswap(object.overall),
      reason: object.reason,
    };
    rows.push(row);
    console.error(`${sa.run} ${row.overall} ${sa.question}`);
  }

  const tally = (key: Verdict) => {
    const count = (label: string) =>
      rows.filter((r) => r[key] === label).length;
    return `${a.label} ${count(a.label)} / ${b.label} ${count(b.label)} / tie ${count("tie")}`;
  };
  const kw = (label: string) => {
    const scored = rows.filter((r) => r.keyword[label] !== undefined);
    return `${scored.filter((r) => r.keyword[label]).length}/${scored.length}`;
  };
  console.log(`pairs ${rows.length}`);
  console.log(
    `keyword pass: ${a.label} ${kw(a.label)}, ${b.label} ${kw(b.label)}`,
  );
  for (const key of [
    "accuracy",
    "helpfulness",
    "persona",
    "overall",
  ] as const) {
    console.log(`${key}: ${tally(key)}`);
  }
  if (values.out) writeFileSync(values.out, JSON.stringify(rows, null, 2));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
