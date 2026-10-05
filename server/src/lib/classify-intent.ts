import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { intentRouterAgent } from "~/mastra/agents/intent-router-agent";
import {
  type ChoiceQuestion,
  createDecider,
  type Decider,
} from "~/services/decision/decider";

const THINKING_THRESHOLD = 0.3;

const VILLAGE_THRESHOLD = 0.3;

const intentQuestion = {
  type: "choice",
  instructions:
    "ユーザーの最新のメッセージの意図を分類する。迷ったら thinking にする。",
  criteria: {
    casual:
      "挨拶、雑談、相槌、リアクション、気持ちや日常の出来事の共有。情報を調べる必要がない。",
    thinking: "検索や推論が必要な質問、情報の依頼、事実確認。",
  },
} as const satisfies ChoiceQuestion;

const routeQuestion = {
  type: "choice",
  instructions:
    "アシスタントは北海道の小さな村・音威子府村のマスコットで、村の資料か Web 検索をもとに答える。ユーザーの最新のメッセージに答えるために調べる先を判定する。",
  criteria: {
    village:
      "音威子府村そのものの情報。村の施設、お店、行事、学校、行政、歴史、地域のルール、地域バスの時刻、村からのお知らせ。",
    outside:
      "最新の情報や村の外の情報。天気、交通や列車の運行状況、ニュースや時事、村の外の場所や一般的な事柄。",
  },
} as const satisfies ChoiceQuestion;

const NO_BACKCHANNEL = "none";

const backchannelQuestion = {
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
    [NO_BACKCHANNEL]: "どれにも当たらない",
  },
} as const satisfies ChoiceQuestion;

export type Backchannel = Exclude<
  keyof typeof backchannelQuestion.criteria,
  typeof NO_BACKCHANNEL
>;

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

const classifyWithDecider = async (
  input: ClassifyTurnInput,
  decider: Decider,
) => {
  const { intent, route, backchannel } = await decider.decide(
    buildState(input),
    {
      intent: intentQuestion,
      route: routeQuestion,
      backchannel: backchannelQuestion,
    },
  );
  return {
    ...withRoute(
      intent.probabilities.thinking >= THINKING_THRESHOLD
        ? "thinking"
        : "casual",
      route.probabilities.village,
    ),
    ...(backchannel.choice !== NO_BACKCHANNEL && {
      backchannel: backchannel.choice,
    }),
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
  const decider = createDecider(requestContext, {
    source: "intent-classify",
    agent: "intent-router",
  });
  if (!decider) {
    return classifyWithAgent(input.text, requestContext);
  }
  try {
    return await classifyWithDecider(input, decider);
  } catch (error) {
    logger.warn("[ClassifyTurn] jev failed, falling back to agent", {
      error: String(error),
    });
    return classifyWithAgent(input.text, requestContext);
  }
};
