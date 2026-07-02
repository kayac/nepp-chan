import type { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { knowledgeAgent } from "~/mastra/agents/knowledge-agent";
import {
  NEED_KNOWLEDGE,
  NEED_WEB,
  voiceSummarizerAgent,
} from "~/mastra/agents/voice-summarizer-agent";
import { webResearcherAgent } from "~/mastra/agents/web-researcher-agent";
import type { VoiceFindings } from "~/services/voice/findings-slot";
import {
  getVoiceFindings,
  getVoiceSearchStart,
  getVoiceTurnSignal,
} from "./helpers";

export const voiceAnswerToolName = "voiceAnswerTool";

const ABORTED_ANSWER = "ごめんね、うまく調べられなかったみたい。";

type Decision =
  | { kind: "answer"; text: string }
  | { kind: "route"; source: "knowledge" | "web" }
  | { kind: "miss" };

const decide = async (
  question: string,
  findings: string | undefined,
  requestContext: RequestContext | undefined,
  signal: AbortSignal | undefined,
): Promise<Decision> => {
  const prompt = findings
    ? `質問:「${question}」\n\n手元の資料:\n${findings}`
    : `質問:「${question}」\n\n手元の資料: なし`;
  const res = await voiceSummarizerAgent.generate(prompt, {
    requestContext,
    abortSignal: signal,
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
  source: "knowledge" | "web",
  question: string,
  requestContext: RequestContext | undefined,
  signal: AbortSignal | undefined,
): Promise<string> => {
  const agent = source === "web" ? webResearcherAgent : knowledgeAgent;
  const res = await agent.generate(question, {
    requestContext,
    abortSignal: signal,
  });
  return res.text ?? "";
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
  execute: async (inputData, context) => {
    const { question } = inputData;
    const requestContext = context?.requestContext;
    const slot = getVoiceFindings(context);
    const startHold = getVoiceSearchStart(context);
    const signal = getVoiceTurnSignal(context);

    try {
      if (!slot?.current) startHold?.();

      const first = await decide(
        question,
        slot?.current?.text,
        requestContext,
        signal,
      );
      if (signal?.aborted) return { answer: ABORTED_ANSWER };
      if (first.kind === "answer") {
        return { answer: first.text };
      }

      startHold?.();
      const routes: Array<"knowledge" | "web"> =
        first.kind === "route" && first.source === "web"
          ? ["web"]
          : ["knowledge", "web"];

      for (const source of routes) {
        const text = await runSearch(source, question, requestContext, signal);
        if (signal?.aborted) return { answer: ABORTED_ANSWER };
        const findings: VoiceFindings = { query: question, source, text };
        if (slot) slot.current = findings;

        const answer = await decide(question, text, requestContext, signal);
        if (signal?.aborted) return { answer: ABORTED_ANSWER };
        if (answer.kind === "answer") {
          return { answer: answer.text };
        }
      }

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
