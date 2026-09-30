import type { RequestContext } from "@mastra/core/request-context";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { classifyTurn, type TurnRoute } from "~/lib/classify-intent";
import { logger } from "~/lib/logger";
import { knowledgeAgent } from "~/mastra/agents/knowledge-agent";
import { webResearcherAgent } from "~/mastra/agents/web-researcher-agent";
import {
  type KnowledgeResult,
  searchKnowledge,
} from "~/services/knowledge/search";

const COVERAGE_RULE = `
調査メモの最後の行に、次のどれか 1 つだけを書く。判定はユーザーの発言に答えられるかで決める。
判定: 取れた（ユーザーが聞いていることの中心に答える事実が揃っている）
判定: 一部（中心に答える事実はあるが、細部が確認できない）
判定: 取れない（ユーザーが聞いていることの中心に答える事実が見つからない）`;

const MEMO_FORMAT = `
調査メモは、質問に答える事実の箇条書きと出典 URL だけにする。文章に整えず、1 項目 1 行、多くても 8 行。`;

const renderSearchResults = (results: KnowledgeResult[]) =>
  results
    .map((r, i) => {
      const heading = [r.title, r.section].filter(Boolean).join(" / ");
      const url = r.url ? ` (${r.url})` : "";
      const date = r.date ? ` [${r.date} ${r.dateType ?? ""}]` : "";
      return `【${i + 1}】${heading}${url}${date}\n${r.content}`;
    })
    .join("\n\n");

const preSearch = async (
  searchTerms: string[],
  requestContext?: RequestContext,
) => {
  const env = requestContext?.get("env") as CloudflareBindings | undefined;
  if (!env?.VECTORIZE || !env.GOOGLE_GENERATIVE_AI_API_KEY) return undefined;
  const { VECTORIZE, GOOGLE_GENERATIVE_AI_API_KEY } = env;
  const outputs = await Promise.all(
    searchTerms.map((term) =>
      searchKnowledge(
        term,
        VECTORIZE,
        GOOGLE_GENERATIVE_AI_API_KEY,
        requestContext,
      ),
    ),
  );
  if (outputs.every((output) => output.error)) return undefined;
  const seen = new Set<string>();
  const results = outputs
    .flatMap((output) => output.results)
    .filter((result) => {
      if (seen.has(result.content)) return false;
      seen.add(result.content);
      return true;
    });
  return renderSearchResults(results) || "該当なし";
};

const coverageSchema = z.enum(["取れた", "一部", "取れない"]);

type Coverage = z.infer<typeof coverageSchema>;

const COVERAGE_LINE =
  /\n?\s*(?:[-・*]\s*)?判定[:：]\s*(取れた|一部|取れない)[^\n]*\s*$/;

export const parseCoverage = (memo: string): Coverage =>
  (memo.match(COVERAGE_LINE)?.[1] as Coverage | undefined) ?? "一部";

const stripCoverage = (memo: string) => memo.replace(COVERAGE_LINE, "").trim();

const routeFor = async (
  text: string,
  requestContext: RequestContext | undefined,
) => {
  const route =
    ((await requestContext?.get("turnRoute")) as TurnRoute | undefined) ??
    (await classifyTurn({ text }, requestContext)).route;
  return route === "outside" ? ("outside" as const) : ("village" as const);
};

const questionSchema = z.object({
  question: z.string(),
  userText: z.string().optional(),
  queries: z.array(z.string()).optional(),
});

const describeQuestion = ({
  question,
  userText,
}: z.infer<typeof questionSchema>) =>
  userText && userText !== question
    ? `ユーザーの発言: ${userText}\n文脈を補った質問: ${question}`
    : `ユーザーの質問: ${question}`;

const routedSchema = questionSchema.extend({
  route: z.enum(["village", "outside"]),
});

const knowledgeSchema = routedSchema.extend({
  knowledgeMemo: z.string().optional(),
  coverage: coverageSchema.optional(),
});

const memoSchema = z.object({ memo: z.string() });

const renderMemo = (parts: { knowledge?: string; web?: string }) =>
  [
    parts.knowledge ? `### 村のナレッジ\n${parts.knowledge}` : "",
    parts.web ? `### Web 検索\n${parts.web}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

const routeStep = createStep({
  id: "research-route",
  inputSchema: questionSchema,
  outputSchema: routedSchema,
  execute: async ({ inputData, requestContext }) => ({
    ...inputData,
    route: await routeFor(
      inputData.userText || inputData.question,
      requestContext,
    ),
  }),
});

const knowledgeStep = createStep({
  id: "research-knowledge",
  inputSchema: routedSchema,
  outputSchema: knowledgeSchema,
  execute: async ({ inputData, requestContext }) => {
    if (inputData.route === "outside") return inputData;
    const searchTerms = inputData.queries?.length
      ? inputData.queries
      : [inputData.question];
    const searchStartedAt = Date.now();
    const searched = await preSearch(searchTerms, requestContext);
    const preSearchMs = Date.now() - searchStartedAt;
    const searchedSection = searched
      ? `最初の検索結果（検索語: ${searchTerms.join(" / ")}）:\n${searched}\n\n足りない情報だけ、検索済みの語と違う観点で追加検索してよい。\n`
      : "";
    const prompt = `${describeQuestion(inputData)}\n${searchedSection}${MEMO_FORMAT}\n${COVERAGE_RULE}`;
    const agentStartedAt = Date.now();
    const res = await knowledgeAgent.generate(prompt, { requestContext });
    const coverage = parseCoverage(res.text);
    logger.info("[Research] knowledge", {
      question: inputData.question,
      ...(inputData.userText && { userText: inputData.userText }),
      searchTerms: searchTerms.length,
      preSearchMs,
      agentMs: Date.now() - agentStartedAt,
      extraSearches: res.steps
        .flatMap((step) => step.toolCalls)
        .filter((call) => call.payload.toolName === "knowledgeSearchTool")
        .length,
      promptChars: prompt.length,
      memoChars: res.text.length,
      coverage,
    });
    return {
      ...inputData,
      knowledgeMemo: stripCoverage(res.text),
      coverage,
    };
  },
});

const webStep = createStep({
  id: "research-web",
  inputSchema: knowledgeSchema,
  outputSchema: memoSchema,
  execute: async ({ inputData, requestContext }) => {
    const prompt = inputData.knowledgeMemo
      ? `${describeQuestion(inputData)}\n\n村のナレッジで確認できた内容:\n${inputData.knowledgeMemo}\n\n不足している点だけを調べる。`
      : describeQuestion(inputData);
    const startedAt = Date.now();
    const res = await webResearcherAgent.generate(prompt, { requestContext });
    logger.info("[Research] web", {
      question: inputData.question,
      ms: Date.now() - startedAt,
      memoChars: res.text.length,
    });
    return {
      memo: renderMemo({ knowledge: inputData.knowledgeMemo, web: res.text }),
    };
  },
});

const finishStep = createStep({
  id: "research-finish",
  inputSchema: knowledgeSchema,
  outputSchema: memoSchema,
  execute: async ({ inputData }) => ({
    memo: renderMemo({ knowledge: inputData.knowledgeMemo }),
  }),
});

const outputStep = createStep({
  id: "research-output",
  inputSchema: z.object({
    [webStep.id]: memoSchema.optional(),
    [finishStep.id]: memoSchema.optional(),
  }),
  outputSchema: memoSchema,
  execute: async ({ inputData }) =>
    inputData[webStep.id] ?? inputData[finishStep.id] ?? { memo: "" },
});

const needsWeb = ({
  inputData,
}: {
  inputData: z.infer<typeof knowledgeSchema>;
}) => inputData.route === "outside" || inputData.coverage === "取れない";

export const researchWorkflow = createWorkflow({
  id: "research",
  inputSchema: questionSchema,
  outputSchema: memoSchema,
  options: { shouldPersistSnapshot: () => false },
})
  .then(routeStep)
  .then(knowledgeStep)
  .branch([
    [async (args) => needsWeb(args), webStep],
    [async (args) => !needsWeb(args), finishStep],
  ])
  .then(outputStep)
  .commit();

export const runResearch = async ({
  question,
  userText,
  queries,
  requestContext,
}: {
  question: string;
  userText?: string;
  queries?: string[];
  requestContext?: RequestContext;
}) => {
  const run = await researchWorkflow.createRun();
  const result = await run.start({
    inputData: { question, userText, queries },
    requestContext,
  });
  if (result.status !== "success") {
    throw new Error(`research workflow ${result.status}`);
  }
  return result.result;
};
