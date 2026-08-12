import type { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { createKnowledgeAgent } from "~/mastra/agents/knowledge-agent";
import {
  NEED_KNOWLEDGE,
  NEED_WEB,
  voiceSummarizerAgent,
} from "~/mastra/agents/voice-summarizer-agent";
import { createWebResearcherAgent } from "~/mastra/agents/web-researcher-agent";
import {
  hasVoiceFindings,
  pushVoiceFindings,
  type VoiceFindings,
} from "~/services/voice/findings-slot";
import {
  getVoiceFindings,
  getVoiceParentRouting,
  getVoicePrefetch,
  getVoiceSearchStart,
  getVoiceTurnSignal,
} from "./helpers";

export const voiceAnswerToolName = "voiceAnswerTool";

const ABORTED_ANSWER = "ごめんね、うまく調べられなかったみたい。";

const PREFETCH_GRACE_MS = 150;

const voiceKnowledgeAgent = createKnowledgeAgent();
const voiceWebResearcherAgent = createWebResearcherAgent();

type Source = "knowledge" | "web";

type Decision =
  | { kind: "answer"; text: string }
  | { kind: "route"; source: Source }
  | { kind: "miss" };

const renderFindings = (entries: VoiceFindings[]) =>
  entries
    .map(
      (entry, i) =>
        `【資料${i + 1} | 質問「${entry.query}」 | ${entry.source}】\n${entry.text}`,
    )
    .join("\n\n");

const decide = async (
  question: string,
  findings: string | undefined,
  requestContext: RequestContext | undefined,
  signal: AbortSignal | undefined,
): Promise<Decision> => {
  const prompt = findings
    ? `質問:「${question}」\n\n手元の資料:\n${findings}`
    : `質問:「${question}」\n\n手元の資料: なし`;
  const start = Date.now();
  const res = await voiceSummarizerAgent.generate(prompt, {
    requestContext,
    abortSignal: signal,
  });
  logger.info("[Voice] decide done", {
    ms: Date.now() - start,
    withFindings: Boolean(findings),
  });
  const out = (res.text ?? "").trim();
  if (out.startsWith(NEED_KNOWLEDGE)) {
    return { kind: "route", source: "knowledge" };
  }
  if (out.startsWith(NEED_WEB)) return { kind: "route", source: "web" };
  if (!out) return { kind: "miss" };
  return { kind: "answer", text: out };
};

const runSearch = async (
  source: Source,
  question: string,
  requestContext: RequestContext | undefined,
  signal: AbortSignal | undefined,
) => {
  const agent =
    source === "web" ? voiceWebResearcherAgent : voiceKnowledgeAgent;
  const res = await agent.generate(question, {
    requestContext,
    abortSignal: signal,
  });
  return res.text ?? "";
};

export const startVoicePrefetch = ({
  question,
  requestContext,
  signal,
}: {
  question: string;
  requestContext?: RequestContext;
  signal?: AbortSignal;
}) => {
  const start = Date.now();
  return voiceKnowledgeAgent
    .generate(question, { requestContext, abortSignal: signal })
    .then((res) => {
      const text = res.text ?? "";
      logger.info("[Voice] prefetch done", {
        ms: Date.now() - start,
        query: question,
        resultChars: text.length,
      });
      return text;
    })
    .catch((error) => {
      logger.info("[Voice] prefetch dropped", {
        ms: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      });
      return "";
    });
};

export const voiceAnswerTool = createTool({
  id: "voice-answer",
  description:
    "村の情報・最新情報・時事・天気など、事実にもとづく質問に答えるための要点を取得します。",
  inputSchema: z.object({
    question: z
      .string()
      .describe("ユーザーが知りたいこと。会話の流れをふまえた具体的な問い"),
    source: z
      .enum(["knowledge", "web"])
      .optional()
      .describe(
        "音威子府村ローカルのこと（施設・観光・行政・歴史・イベント・村の店）は knowledge、天気・ニュース・時事・村外の一般的なことは web",
      ),
  }),
  outputSchema: z.object({
    answer: z.string(),
  }),
  execute: async (inputData, context) => {
    const { question, source } = inputData;
    const requestContext = context?.requestContext;
    const slot = getVoiceFindings(context);
    const prefetchSlot = getVoicePrefetch(context);
    const parentRouting = getVoiceParentRouting(context);
    const startHold = getVoiceSearchStart(context);
    const signal = getVoiceTurnSignal(context);
    const t0 = Date.now();

    try {
      logger.info("[Voice] answer start", {
        question,
        source: source ?? "",
        parentRouting,
        hasPrefetch: Boolean(prefetchSlot?.current),
        slotEntries: slot?.entries.length ?? 0,
        slotChars:
          slot?.entries.reduce((sum, entry) => sum + entry.text.length, 0) ?? 0,
      });

      let routes: Source[];
      if (parentRouting && !hasVoiceFindings(slot)) {
        routes = source === "web" ? ["web"] : ["knowledge", "web"];
      } else {
        if (!hasVoiceFindings(slot)) startHold?.();
        const first = await decide(
          question,
          slot && hasVoiceFindings(slot)
            ? renderFindings(slot.entries)
            : undefined,
          requestContext,
          signal,
        );
        if (signal?.aborted) return { answer: ABORTED_ANSWER };
        if (first.kind === "answer") {
          logger.info("[Voice] answered from slot", {
            answer: first.text,
            totalMs: Date.now() - t0,
          });
          return { answer: first.text };
        }
        routes =
          first.kind === "route" && first.source === "web"
            ? ["web"]
            : ["knowledge", "web"];
      }

      const tryAnswer = async (
        route: Source,
        text: string,
        timing: { ms: number; fromPrefetch: boolean },
      ) => {
        const findings: VoiceFindings = {
          query: question,
          source: route,
          text,
        };
        if (slot) pushVoiceFindings(slot, findings);
        logger.info("[Voice] search done", {
          source: route,
          query: question,
          ...timing,
          resultChars: text.length,
          resultHead: text.slice(0, 120),
          savedToSlot: slot !== undefined,
        });
        const answer = await decide(question, text, requestContext, signal);
        if (answer.kind !== "answer") return undefined;
        logger.info("[Voice] answered from search", {
          source: route,
          answer: answer.text,
          totalMs: Date.now() - t0,
        });
        return answer.text;
      };

      const prefetched =
        routes[0] === "knowledge" ? prefetchSlot?.current : undefined;
      if (prefetchSlot?.current && !prefetched) prefetchSlot.current.abort();
      if (prefetchSlot) prefetchSlot.current = undefined;

      if (prefetched) {
        const waitStart = Date.now();
        const quick = await Promise.race([
          prefetched.promise,
          new Promise<undefined>((resolve) =>
            setTimeout(() => resolve(undefined), PREFETCH_GRACE_MS),
          ),
        ]);
        if (quick === undefined) startHold?.();
        const text = quick ?? (await prefetched.promise);
        if (signal?.aborted) return { answer: ABORTED_ANSWER };
        if (text) {
          const answer = await tryAnswer("knowledge", text, {
            ms: Date.now() - waitStart,
            fromPrefetch: true,
          });
          if (signal?.aborted) return { answer: ABORTED_ANSWER };
          if (answer !== undefined) return { answer };
        }
      }

      startHold?.();

      for (const route of routes) {
        const searchStart = Date.now();
        const text = await runSearch(route, question, requestContext, signal);
        if (signal?.aborted) return { answer: ABORTED_ANSWER };
        const answer = await tryAnswer(route, text, {
          ms: Date.now() - searchStart,
          fromPrefetch: false,
        });
        if (signal?.aborted) return { answer: ABORTED_ANSWER };
        if (answer !== undefined) return { answer };
      }

      logger.info("[Voice] no answer found", {
        question,
        totalMs: Date.now() - t0,
      });
      return { answer: "ごめんね、それは今わからなかったな。" };
    } catch (error) {
      if (signal?.aborted) return { answer: ABORTED_ANSWER };
      logger.error("[Voice] voiceAnswer failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { answer: "ごめんね、うまく調べられなかったみたい。" };
    }
  },
});
