import type { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { logger } from "~/lib/logger";
import {
  NEED_SEARCH,
  voiceSummarizerAgent,
} from "~/mastra/agents/voice-summarizer-agent";
import { runResearch } from "~/mastra/workflows/research-workflow";
import {
  pushVoiceFindings,
  type VoiceFindings,
} from "~/services/voice/findings-slot";
import {
  getLastUserText,
  getVoiceFindings,
  getVoiceSearchStart,
  getVoiceTurnSignal,
} from "./helpers";

export const voiceAnswerToolName = "voiceAnswerTool";

const FAILED_ANSWER = "ごめんね、うまく調べられなかったみたい。";

const UNKNOWN_ANSWER = "ごめんね、それは今わからなかったな。";

const renderFindings = (entries: VoiceFindings[]) =>
  entries
    .map(
      (entry, i) => `【資料${i + 1} | 質問「${entry.query}」】\n${entry.text}`,
    )
    .join("\n\n");

const summarize = async (
  question: string,
  findings: string,
  requestContext: RequestContext | undefined,
  signal: AbortSignal | undefined,
) => {
  const start = Date.now();
  const res = await voiceSummarizerAgent.generate(
    `質問:「${question}」\n\n手元の資料:\n${findings}`,
    { requestContext, abortSignal: signal },
  );
  logger.info("[Voice] summarize done", { ms: Date.now() - start });
  const out = (res.text ?? "").trim();
  return out && !out.startsWith(NEED_SEARCH) ? out : undefined;
};

export const voiceAnswerTool = createTool({
  id: "voice-answer",
  description:
    "村の情報・最新情報・時事・天気など、事実にもとづく質問に答えるための要点を取得します。",
  inputSchema: z.object({
    question: z
      .string()
      .describe("ユーザーが知りたいこと。会話の流れをふまえた具体的な問い"),
  }),
  outputSchema: z.object({
    answer: z.string(),
  }),
  execute: async ({ question }, context) => {
    const requestContext = context?.requestContext;
    const slot = getVoiceFindings(context);
    const startHold = getVoiceSearchStart(context);
    const signal = getVoiceTurnSignal(context);
    const t0 = Date.now();

    try {
      if (slot?.entries.length) {
        const answer = await summarize(
          question,
          renderFindings(slot.entries),
          requestContext,
          signal,
        );
        if (signal?.aborted) return { answer: FAILED_ANSWER };
        if (answer) {
          logger.info("[Voice] answered from slot", {
            answer,
            totalMs: Date.now() - t0,
          });
          return { answer };
        }
      }

      if (signal?.aborted) return { answer: FAILED_ANSWER };
      startHold?.();
      const { memo } = await runResearch({
        question,
        userText: getLastUserText(context),
        requestContext,
        signal,
      });
      if (signal?.aborted) return { answer: FAILED_ANSWER };
      const researchMs = Date.now() - t0;
      const answer = memo
        ? await summarize(question, memo, requestContext, signal)
        : undefined;
      if (signal?.aborted) return { answer: FAILED_ANSWER };
      if (!answer) {
        logger.info("[Voice] no answer found", {
          question,
          totalMs: Date.now() - t0,
        });
        return { answer: UNKNOWN_ANSWER };
      }
      if (slot) pushVoiceFindings(slot, { query: question, text: memo });
      logger.info("[Voice] answered from search", {
        answer,
        researchMs,
        totalMs: Date.now() - t0,
      });
      return { answer };
    } catch (error) {
      if (signal?.aborted) return { answer: FAILED_ANSWER };
      logger.error("[Voice] voiceAnswer failed", error);
      return { answer: FAILED_ANSWER };
    }
  },
});
