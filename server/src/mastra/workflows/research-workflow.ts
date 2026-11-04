import type { ChoiceQuestion } from "@mastra/core/classifier";
import type { RequestContext } from "@mastra/core/request-context";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { logger } from "~/lib/logger";
import {
  type Coverage,
  coverageSchema,
  knowledgeMemoAgent,
  knowledgeMemoSchema,
} from "~/mastra/agents/knowledge-memo-agent";
import { webResearcherAgent } from "~/mastra/agents/web-researcher-agent";
import { broadcastRepository } from "~/repository/broadcast-repository";
import { createDecider } from "~/services/decision/decider";
import {
  type KnowledgeResult,
  searchKnowledge,
} from "~/services/knowledge/search";

const MAX_KNOWLEDGE_ATTEMPTS = 2;

const MAX_ASPECTS = 5;

const MAX_QUERIES_PER_ASPECT = 3;

const CHUNKS_PER_ASPECT = 5;

const BROADCAST_LIMIT = 5;

const VILLAGE_THRESHOLD = 0.3;

const routeCriteria = {
  village:
    "音威子府村そのものの情報。村の施設、お店、行事、学校、行政、制度、歴史、地域のルール、地域バスの時刻、村からのお知らせ。",
  outside:
    "最新の情報や村の外の情報。天気、列車や道路の運行状況、ニュースや時事、村の外の場所や一般的な事柄。",
} as const;

const routeInstructions =
  "アシスタントは北海道の小さな村・音威子府村のマスコットで、村の資料か Web 検索をもとに答える。aspects の各観点について、調べる先を判定する。迷ったら village。";

const routeQuestionFor = (id: string) =>
  ({
    type: "choice",
    instructions: `id が ${id} の観点の調べ先`,
    criteria: routeCriteria,
  }) as const satisfies ChoiceQuestion;

export const researchInputSchema = z.object({
  question: z
    .string()
    .describe(
      "ユーザーの質問。ユーザーの言葉をなるべくそのまま使い、指示語だけ会話の流れから補う",
    ),
  aspects: z
    .array(
      z.object({
        topic: z
          .string()
          .describe(
            "調べる観点。手続き・制度・施設・日程など、答えに必要な要素 1 つ",
          ),
        queries: z
          .array(z.string())
          .min(1)
          .max(MAX_QUERIES_PER_ASPECT)
          .describe(
            "その観点を村の資料から探す検索語。資料に出てきそうな制度名・施設名・手続き名で書く。ユーザーが略称で言ったら略称と正式名称の両方を入れる（国保 と 国民健康保険）。年度は資料どおり令和表記のまま",
          ),
      }),
    )
    .min(1)
    .max(MAX_ASPECTS)
    .describe(
      "質問に答えるのに要る観点だけ。1 つで足りる質問は 1 つ。念のための観点は足さない",
    ),
});

type ResearchInput = z.infer<typeof researchInputSchema>;

const aspectSchema = z.object({
  topic: z.string(),
  queries: z.array(z.string()),
  route: z.enum(["village", "outside"]),
  chunks: z.array(z.string()),
  coverage: coverageSchema.optional(),
  retryQuery: z.string().optional(),
});

type Aspect = z.infer<typeof aspectSchema>;

const stateSchema = z.object({
  question: z.string(),
  aspects: z.array(aspectSchema),
  broadcasts: z.string().optional(),
  memo: z.string().optional(),
  attempts: z.number(),
});

type ResearchState = z.infer<typeof stateSchema>;

const memoSchema = z.object({ memo: z.string() });

const routeAspects = async (
  question: string,
  aspects: ResearchInput["aspects"],
  requestContext: RequestContext | undefined,
) => {
  const allVillage = aspects.map(() => "village" as const);
  const decider = createDecider(requestContext, {
    source: "intent-classify",
    agent: "research-route",
  });
  if (!decider) return allVillage;
  const ids = aspects.map((_, i) => `a${i}`);
  try {
    const answers = await decider.decide(
      {
        instructions: routeInstructions,
        question,
        aspects: aspects.map((a, i) => ({ id: ids[i], topic: a.topic })),
      },
      Object.fromEntries(ids.map((id) => [id, routeQuestionFor(id)])),
    );
    return ids.map((id) =>
      (answers[id].probabilities?.village ?? 1) >= VILLAGE_THRESHOLD
        ? ("village" as const)
        : ("outside" as const),
    );
  } catch (error) {
    logger.warn("[Research] route failed, treating all as village", {
      error: String(error),
    });
    return allVillage;
  }
};

const renderResult = (r: KnowledgeResult) => {
  const heading = [r.title, r.section].filter(Boolean).join(" / ");
  const url = r.url ? ` (${r.url})` : "";
  const date = r.date ? ` [${r.date} ${r.dateType ?? ""}]` : "";
  return `${heading}${url}${date}\n${r.content}`;
};

const searchChunks = async (
  queriesPerAspect: string[][],
  requestContext: RequestContext | undefined,
) => {
  const env = requestContext?.get("env") as CloudflareBindings | undefined;
  if (!env?.VECTORIZE || !env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return queriesPerAspect.map(() => []);
  }
  return Promise.all(
    queriesPerAspect.map(async (queries) => {
      const outputs = await Promise.all(
        queries.map((query) =>
          searchKnowledge(
            query,
            env.VECTORIZE,
            env.GOOGLE_GENERATIVE_AI_API_KEY,
            requestContext,
          ),
        ),
      );
      const seen = new Set<string>();
      return outputs
        .flatMap((o) => o.results)
        .sort((a, b) => b.score - a.score)
        .filter((r) => !seen.has(r.content) && seen.add(r.content))
        .slice(0, CHUNKS_PER_ASPECT)
        .map(renderResult);
    }),
  );
};

const searchBroadcasts = async (
  keywords: string[],
  requestContext: RequestContext | undefined,
) => {
  const db = requestContext?.get("db") as D1Database | undefined;
  if (!db) return undefined;
  try {
    const broadcasts = await broadcastRepository.findByKeyword(
      db,
      keywords.join(" "),
      BROADCAST_LIMIT,
    );
    return broadcasts
      .map(
        (b, i) =>
          `【配信${i + 1}】${b.title}${b.sentAt ? ` [${b.sentAt}]` : ""}\n${b.body}`,
      )
      .join("\n\n");
  } catch (error) {
    logger.warn("[Research] broadcast search failed", {
      error: String(error),
    });
    return undefined;
  }
};

const planStep = createStep({
  id: "research-plan",
  inputSchema: researchInputSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData, requestContext }) => {
    const startedAt = Date.now();
    const routes = await routeAspects(
      inputData.question,
      inputData.aspects,
      requestContext,
    );
    const village = inputData.aspects.filter((_, i) => routes[i] === "village");
    const [searched, broadcasts] = await Promise.all([
      searchChunks(
        village.map((a) => a.queries),
        requestContext,
      ),
      village.length
        ? searchBroadcasts(
            village.flatMap((a) => a.queries),
            requestContext,
          )
        : undefined,
    ]);
    const aspects = inputData.aspects.map((a, i) => ({
      ...a,
      route: routes[i],
      chunks: routes[i] === "village" ? searched[village.indexOf(a)] : [],
    }));
    logger.info("[Research] plan", {
      aspects: aspects.length,
      outside: aspects.filter((a) => a.route === "outside").length,
      ms: Date.now() - startedAt,
    });
    return { question: inputData.question, aspects, broadcasts, attempts: 0 };
  },
});

const villageAspects = (state: ResearchState) =>
  state.aspects.filter((a) => a.route === "village");

const retryTargets = (state: ResearchState) =>
  villageAspects(state).filter(
    (a) => a.coverage === "取れない" && a.retryQuery,
  );

const renderMaterials = (aspects: Aspect[]) => {
  const chunks: string[] = [];
  const numberOf = (chunk: string) => {
    const found = chunks.indexOf(chunk);
    if (found >= 0) return found + 1;
    chunks.push(chunk);
    return chunks.length;
  };
  const perAspect = aspects.map(
    (a) =>
      `## 観点: ${a.topic}\n${a.chunks.length ? a.chunks.map((c) => `【${numberOf(c)}】`).join("") : "該当なし"}`,
  );
  return [
    ...perAspect,
    `## 資料\n${chunks.map((c, i) => `【${i + 1}】${c}`).join("\n\n")}`,
  ].join("\n\n");
};

const firstPrompt = (state: ResearchState) =>
  [
    `ユーザーの質問: ${state.question}`,
    `村のナレッジの検索結果:\n${renderMaterials(villageAspects(state))}`,
    state.broadcasts && `村の LINE 配信（新しい順）:\n${state.broadcasts}`,
    "上の検索結果と配信だけから調査メモを書き、観点ごとの取れ具合を付ける。",
  ]
    .filter(Boolean)
    .join("\n\n");

const retryPrompt = (state: ResearchState, retried: Aspect[]) =>
  [
    `ユーザーの質問: ${state.question}`,
    `前回の調査メモ:\n${state.memo}`,
    `引き直した観点の検索結果:\n${renderMaterials(retried)}`,
    `前回の調査メモを土台に、引き直した観点だけを上の検索結果で更新して書き直す。他の観点の内容は変えない。取れ具合は全部の観点（${villageAspects(
      state,
    )
      .map((a) => a.topic)
      .join(" / ")}）に付ける。`,
  ].join("\n\n");

const knowledgeStep = createStep({
  id: "research-knowledge",
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData, requestContext, abortSignal }) => {
    if (villageAspects(inputData).length === 0) return inputData;
    const startedAt = Date.now();
    const retried = inputData.attempts === 0 ? [] : retryTargets(inputData);
    const found = await searchChunks(
      retried.map((a) => (a.retryQuery ? [a.retryQuery] : a.queries)),
      requestContext,
    );
    const searched = inputData.aspects.map((aspect) => {
      const i = retried.indexOf(aspect);
      if (i < 0) return aspect;
      return {
        ...aspect,
        chunks: [...new Set([...aspect.chunks, ...found[i]])],
      };
    });
    const state = { ...inputData, aspects: searched };
    const searchMs = Date.now() - startedAt;
    const fallback = { memo: "", aspects: [] };
    const res = await knowledgeMemoAgent.generate(
      retried.length === 0
        ? firstPrompt(state)
        : retryPrompt(
            state,
            searched.filter((a) => retried.some((r) => r.topic === a.topic)),
          ),
      {
        requestContext,
        abortSignal,
        structuredOutput: {
          schema: knowledgeMemoSchema,
          errorStrategy: "fallback",
          fallbackValue: fallback,
        },
      },
    );
    const written = res.object ?? fallback;
    const memo = written.memo || res.text;
    const aspects = searched.map((aspect) => {
      if (aspect.route !== "village") return aspect;
      const judged = written.aspects.find((a) => a.topic === aspect.topic);
      const coverage: Coverage =
        judged?.coverage ?? aspect.coverage ?? "取れない";
      return { ...aspect, coverage, retryQuery: judged?.retryQuery };
    });
    logger.info("[Research] knowledge", {
      attempt: inputData.attempts + 1,
      retried: retried.length,
      searchMs,
      agentMs: Date.now() - startedAt - searchMs,
      coverage: aspects
        .filter((a) => a.route === "village")
        .map((a) => a.coverage)
        .join(","),
      memoChars: memo.length,
    });
    return { ...state, aspects, memo, attempts: inputData.attempts + 1 };
  },
});

const knowledgeDone = async ({ inputData }: { inputData: ResearchState }) =>
  inputData.attempts >= MAX_KNOWLEDGE_ATTEMPTS ||
  retryTargets(inputData).length === 0;

const renderMemo = (parts: { knowledge?: string; web?: string }) =>
  [
    parts.knowledge ? `### 村のナレッジ\n${parts.knowledge}` : "",
    parts.web ? `### Web 検索\n${parts.web}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

const finalizeStep = createStep({
  id: "research-finalize",
  inputSchema: stateSchema,
  outputSchema: memoSchema,
  execute: async ({ inputData, requestContext, abortSignal }) => {
    const topics = inputData.aspects
      .filter((a) => a.route === "outside" || a.coverage === "取れない")
      .map((a) => a.topic);
    if (topics.length === 0) {
      return { memo: renderMemo({ knowledge: inputData.memo }) };
    }
    const prompt = [
      `ユーザーの質問: ${inputData.question}`,
      inputData.memo && `村のナレッジで確認できた内容:\n${inputData.memo}`,
      `調べる観点: ${topics.join(" / ")}\n上の観点だけを調べる。`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const startedAt = Date.now();
    const res = await webResearcherAgent.generate(prompt, {
      requestContext,
      abortSignal,
    });
    logger.info("[Research] web", {
      topics: topics.length,
      ms: Date.now() - startedAt,
      memoChars: res.text.length,
    });
    return { memo: renderMemo({ knowledge: inputData.memo, web: res.text }) };
  },
});

export const researchWorkflow = createWorkflow({
  id: "research",
  inputSchema: researchInputSchema,
  outputSchema: memoSchema,
  options: { shouldPersistSnapshot: () => false },
})
  .then(planStep)
  .dountil(knowledgeStep, knowledgeDone)
  .then(finalizeStep)
  .commit();

export const runResearch = async ({
  input,
  requestContext,
  signal,
}: {
  input: ResearchInput;
  requestContext?: RequestContext;
  signal?: AbortSignal;
}) => {
  signal?.throwIfAborted();
  const run = await researchWorkflow.createRun();
  signal?.addEventListener("abort", () => void run.cancel(), { once: true });
  const result = await run.start({ inputData: input, requestContext });
  if (result.status !== "success") {
    throw new Error(`research workflow ${result.status}`);
  }
  return result.result;
};
