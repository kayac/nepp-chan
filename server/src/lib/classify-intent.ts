import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import { type JevQuestion, jevApiKey } from "~/lib/jev";
import { logger } from "~/lib/logger";
import { intentRouterAgent } from "~/mastra/agents/intent-router-agent";
import { askJevWithUsage } from "~/services/analytics/llm-usage";

const THINKING_THRESHOLD = 0.3;

const VILLAGE_THRESHOLD = 0.3;

const intentQuestion: JevQuestion = {
  type: "choice",
  instructions:
    "ユーザーの最新のメッセージの意図を分類する。迷ったら thinking にする。",
  criteria: {
    casual:
      "挨拶、雑談、相槌、リアクション、気持ちや日常の出来事の共有。情報を調べる必要がない。",
    thinking: "検索や推論が必要な質問、情報の依頼、事実確認。",
  },
};

const routeQuestion: JevQuestion = {
  type: "choice",
  instructions:
    "アシスタントは北海道の小さな村・音威子府村のマスコットで、村の資料か Web 検索をもとに答える。ユーザーの最新のメッセージに答えるために調べる先を判定する。",
  criteria: {
    village:
      "音威子府村そのものの情報。村の施設、お店、行事、学校、行政、歴史、地域のルール、地域バスの時刻、村からのお知らせ。",
    outside:
      "最新の情報や村の外の情報。天気、交通や列車の運行状況、ニュースや時事、村の外の場所や一般的な事柄。",
  },
};

const BACKCHANNELS = [
  "greeting",
  "agree",
  "happy",
  "sad",
  "surprise",
  "ask",
  "listen",
] as const;

export type Backchannel = (typeof BACKCHANNELS)[number];

const backchannelQuestion: JevQuestion = {
  type: "choice",
  instructions:
    "ユーザーの最新のメッセージに、話し相手が返事の前に入れる相槌の種類を選ぶ。合うものが無ければ none。",
  criteria: {
    greeting: "挨拶",
    agree: "短い同意・返事・お礼",
    happy: "嬉しい・楽しい出来事や、好きなものの話",
    sad: "疲れた・困った・残念など、大変な話",
    surprise: "意外な出来事や、驚くような話",
    ask: "アシスタント自身の好み・意見・気持ちを聞く問いかけ",
    listen: "話を聞いてほしい、続きがありそうな話",
    none: "どれにも当たらない",
  },
};

const NO_BACKCHANNEL = "none";

const isBackchannel = (value: string): value is Backchannel =>
  (BACKCHANNELS as readonly string[]).includes(value);

const intentSchema = z.object({
  intent: z.enum(["casual", "thinking"]),
});

type Intent = z.infer<typeof intentSchema>["intent"];

export type TurnRoute = "none" | "village" | "outside";

export type TurnClass = {
  intent: Intent;
  route: TurnRoute;
  backchannel?: Backchannel;
};

type ClassifyTurnInput = {
  text: string;
  previousAssistant?: string;
};

const buildState = (input: ClassifyTurnInput) => [
  ...(input.previousAssistant
    ? [{ from: "assistant", text: input.previousAssistant }]
    : []),
  { from: "user", text: input.text },
];

const withRoute = (intent: Intent, pVillage = 1): TurnClass => ({
  intent,
  route:
    intent === "casual"
      ? "none"
      : pVillage >= VILLAGE_THRESHOLD
        ? "village"
        : "outside",
});

const classifyWithJev = async (
  input: ClassifyTurnInput,
  apiKey: string,
  requestContext: RequestContext,
) => {
  const response = await askJevWithUsage({
    apiKey,
    state: buildState(input),
    questions: {
      intent: intentQuestion,
      route: routeQuestion,
      backchannel: backchannelQuestion,
    },
    requestContext,
    source: "intent-classify",
    agent: "intent-router",
  });
  const { intent, route, backchannel } = response.answers;
  const pThinking =
    intent?.type === "choice" ? intent.probabilities.thinking : undefined;
  if (pThinking === undefined) {
    throw new Error("jev answer has no thinking probability");
  }
  const pVillage =
    route?.type === "choice" ? route.probabilities.village : undefined;
  const backchannelChoice =
    backchannel?.type === "choice" ? backchannel.choice : NO_BACKCHANNEL;
  return {
    ...withRoute(
      pThinking >= THINKING_THRESHOLD ? "thinking" : "casual",
      pVillage,
    ),
    ...(isBackchannel(backchannelChoice) && { backchannel: backchannelChoice }),
  };
};

const classifyWithAgent = async (
  text: string,
  requestContext?: RequestContext,
) => {
  try {
    const result = await intentRouterAgent.generate(text, {
      requestContext,
      structuredOutput: { schema: intentSchema },
    });
    return withRoute(result.object?.intent ?? "thinking");
  } catch {
    return withRoute("thinking");
  }
};

export const classifyTurn = async (
  input: ClassifyTurnInput,
  requestContext?: RequestContext,
) => {
  const apiKey = jevApiKey(requestContext);
  if (!apiKey || !requestContext) {
    return classifyWithAgent(input.text, requestContext);
  }
  try {
    return await classifyWithJev(input, apiKey, requestContext);
  } catch (error) {
    logger.warn("[ClassifyTurn] jev failed, falling back to agent", {
      error: String(error),
    });
    return classifyWithAgent(input.text, requestContext);
  }
};
