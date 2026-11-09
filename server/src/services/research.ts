import type { ChoiceQuestion } from "@mastra/core/classifier";
import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { webResearcherAgent } from "~/mastra/agents/web-researcher-agent";
import { broadcastRepository } from "~/repository/broadcast-repository";
import { decide } from "~/services/decision/decider";
import {
  type KnowledgeResult,
  searchKnowledge,
} from "~/services/knowledge/search";

const MAX_ASPECTS = 5;

const MAX_QUERIES_PER_ASPECT = 3;

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
        web: z
          .boolean()
          .optional()
          .describe(
            "村の資料に加えて Web でも調べるか。天気・運行状況・ニュースなどの最新情報や村外の事柄、イベントや店の最新状況を補いたい観点は true。制度・手続き・施設の基本情報は false",
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

type Aspect = ResearchInput["aspects"][number];

const routeUndecided = async (
  question: string,
  aspects: Aspect[],
  requestContext: RequestContext | undefined,
) => {
  const undecided = aspects.filter((a) => a.web === undefined);
  if (undecided.length === 0) return aspects;
  const ids = undecided.map((_, i) => `a${i}`);
  const answers = await decide(
    requestContext,
    { source: "intent-classify", agent: "research-route" },
    {
      instructions: routeInstructions,
      question,
      aspects: undecided.map((a, i) => ({ id: ids[i], topic: a.topic })),
    },
    Object.fromEntries(ids.map((id) => [id, routeQuestionFor(id)])),
  );
  const webOf = new Map<Aspect, boolean>();
  if (answers) {
    for (const [i, a] of undecided.entries()) {
      webOf.set(
        a,
        (answers[ids[i]].probabilities?.village ?? 1) < VILLAGE_THRESHOLD,
      );
    }
  }
  return aspects.map((a) =>
    a.web === undefined ? { ...a, web: webOf.get(a) ?? false } : a,
  );
};

const searchChunks = async (
  queriesPerAspect: string[][],
  requestContext: RequestContext | undefined,
) => {
  const env = requestContext?.get("env") as CloudflareBindings | undefined;
  if (!env?.VECTORIZE || !env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return queriesPerAspect.map((): KnowledgeResult[] => []);
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
      return outputs
        .flatMap((o) => o.results)
        .sort((a, b) => b.score - a.score);
    }),
  );
};

const searchBroadcasts = async (
  keywords: string[],
  requestContext: RequestContext | undefined,
) => {
  const db = requestContext?.get("db") as D1Database | undefined;
  if (!db) return [];
  try {
    const broadcasts = await broadcastRepository.findByKeyword(
      db,
      keywords.join(" "),
      BROADCAST_LIMIT,
    );
    return broadcasts.map(({ title, sentAt, body }) => ({
      title,
      sentAt,
      body,
    }));
  } catch (error) {
    logger.warn("[Research] broadcast search failed", {
      error: String(error),
    });
    return [];
  }
};

const searchWeb = async (
  question: string,
  topics: string[],
  requestContext: RequestContext | undefined,
  abortSignal: AbortSignal | undefined,
) => {
  if (topics.length === 0) return "";
  const startedAt = Date.now();
  const res = await webResearcherAgent.generate(
    `ユーザーの質問: ${question}\n\n調べる観点: ${topics.join(" / ")}\n上の観点だけを調べる。`,
    { requestContext, abortSignal },
  );
  logger.info("[Research] web", {
    topics: topics.length,
    ms: Date.now() - startedAt,
    chars: res.text.length,
  });
  return res.text;
};

const queriesFor = (aspect: Aspect) => [
  ...new Set([...aspect.queries, aspect.topic]),
];

const dedupeAcross = (lists: KnowledgeResult[][]) => {
  const seen = new Set<string>();
  return lists.map((results) =>
    results
      .filter((r) => !seen.has(r.content) && seen.add(r.content))
      .map(({ title, section, url, date, dateType, content }) => ({
        title,
        section,
        url,
        date,
        dateType,
        content,
      })),
  );
};

export const research = async (
  input: ResearchInput,
  {
    requestContext,
    signal,
  }: {
    requestContext?: RequestContext;
    signal?: AbortSignal;
  } = {},
) => {
  signal?.throwIfAborted();
  const startedAt = Date.now();
  const aspectQueries = input.aspects.map(queriesFor);
  const questionQueries = aspectQueries.flat().includes(input.question)
    ? []
    : [input.question];
  const [chunks, broadcasts, { aspects, web }] = await Promise.all([
    searchChunks([...aspectQueries, questionQueries], requestContext),
    searchBroadcasts(
      input.aspects.flatMap((a) => a.queries),
      requestContext,
    ),
    routeUndecided(input.question, input.aspects, requestContext).then(
      async (aspects) => ({
        aspects,
        web: await searchWeb(
          input.question,
          aspects.filter((a) => a.web).map((a) => a.topic),
          requestContext,
          signal,
        ),
      }),
    ),
  ]);
  const results = dedupeAcross(chunks);
  const materials = JSON.stringify({
    aspects: aspects.map((a, i) => ({
      topic: a.topic,
      web: a.web === true,
      results: results[i],
    })),
    question:
      questionQueries.length > 0
        ? { text: input.question, results: results[aspects.length] }
        : undefined,
    broadcasts,
    web,
  });
  logger.info("[Research] searched", {
    aspects: aspects.length,
    web: aspects.filter((a) => a.web).length,
    chunks: results.flat().length,
    ms: Date.now() - startedAt,
    chars: materials.length,
  });
  return materials;
};
