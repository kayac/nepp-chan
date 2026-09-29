import type { RequestContext } from "@mastra/core/request-context";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { type JevQuestion, jevApiKey } from "~/lib/jev";
import { logger } from "~/lib/logger";
import {
  OUTSIDE_CRITERION,
  ROUTE_CONTEXT,
  VILLAGE_CRITERION,
  VILLAGE_THRESHOLD,
} from "~/lib/route-criteria";
import { knowledgeAgent } from "~/mastra/agents/knowledge-agent";
import { webResearcherAgent } from "~/mastra/agents/web-researcher-agent";
import { askJevWithUsage } from "~/services/analytics/llm-usage";
import {
  type KnowledgeResult,
  searchKnowledge,
} from "~/services/knowledge/search";

const routeQuestion: JevQuestion = {
  type: "choice",
  instructions: `${ROUTE_CONTEXT} Decide where the answer to the user's question should be looked up.`,
  criteria: {
    village: VILLAGE_CRITERION,
    outside: OUTSIDE_CRITERION,
  },
};

const COVERAGE_RULE = `
調査メモの最後の行に、次のどれか 1 つだけを書く。
判定: 取れた（質問の中心に答える事実が揃っている）
判定: 一部（中心の一部だけ確認できた。時刻表・料金・日程など時期で変わる情報の資料が古く、今も有効か確かめる必要があるときもこれ）
判定: 取れない（質問に答える事実が見つからない）`;

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
  question: string,
  requestContext: RequestContext | undefined,
) => {
  const apiKey = jevApiKey(requestContext);
  if (!apiKey || !requestContext) return "village" as const;
  try {
    const response = await askJevWithUsage({
      apiKey,
      state: [{ from: "user", text: question }],
      questions: { route: routeQuestion },
      requestContext,
      source: "research-route",
      agent: "research-router",
    });
    const answer = response.answers.route;
    const pVillage =
      answer?.type === "choice" ? (answer.probabilities.village ?? 0) : 1;
    return pVillage >= VILLAGE_THRESHOLD
      ? ("village" as const)
      : ("outside" as const);
  } catch (error) {
    logger.warn("[Research] jev route failed, assuming village", {
      error: String(error),
    });
    return "village" as const;
  }
};

const questionSchema = z.object({
  question: z.string(),
  queries: z.array(z.string()).optional(),
});

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
    route: await routeFor(inputData.question, requestContext),
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
      ? `最初の検索結果:\n${searched}\n\n足りない情報だけ追加で検索してよい。\n`
      : "";
    const prompt = `ユーザーの質問: ${inputData.question}\n${searchedSection}${MEMO_FORMAT}\n${COVERAGE_RULE}`;
    const agentStartedAt = Date.now();
    const res = await knowledgeAgent.generate(prompt, { requestContext });
    const coverage = parseCoverage(res.text);
    logger.info("[Research] knowledge", {
      question: inputData.question,
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
      ? `ユーザーの質問: ${inputData.question}\n\n村のナレッジで確認できた内容:\n${inputData.knowledgeMemo}\n\n不足している点と、資料が古い情報がいまも有効かだけを調べる。`
      : `ユーザーの質問: ${inputData.question}`;
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
}) => inputData.route === "outside" || inputData.coverage !== "取れた";

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
  queries,
  requestContext,
}: {
  question: string;
  queries?: string[];
  requestContext?: RequestContext;
}) => {
  const run = await researchWorkflow.createRun();
  const result = await run.start({
    inputData: { question, queries },
    requestContext,
  });
  if (result.status !== "success") {
    throw new Error(`research workflow ${result.status}`);
  }
  return result.result;
};
