import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { z } from "zod";
import {
  primaryModelId,
  resolveModelTier,
  voiceModelConfig,
} from "~/lib/llm-models";
import { emergencyReporterAgent } from "~/mastra/agents/emergency-reporter-agent";
import { knowledgeAgent } from "~/mastra/agents/knowledge-agent";
import {
  createNeppChanAgent,
  neppChanMemoryOptions,
} from "~/mastra/agents/nepp-chan-agent";
import { webResearcherAgent } from "~/mastra/agents/web-researcher-agent";
import { endCallTool, endCallToolName } from "~/mastra/tools/end-call-tool";
import { voiceAnswerToolName } from "~/mastra/tools/voice-answer-tool";
import { fixtures } from "./fixtures";
import type { PersonaCase } from "./schema";

const zeroUsage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

const stop = { unified: "stop" as const, raw: "stop" };

const fixedTextModel = (text: string) =>
  new MockLanguageModelV3({
    provider: "eval",
    modelId: "fixture",
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: stop,
      usage: zeroUsage,
      warnings: [],
    }),
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "fixture" },
          { type: "text-delta", id: "fixture", delta: text },
          { type: "text-end", id: "fixture" },
          { type: "finish", finishReason: stop, usage: zeroUsage },
        ],
      }),
    }),
  });

const fixtureAgent = (source: Agent, text: string) =>
  new Agent({
    id: source.id,
    name: source.name,
    description: source.getDescription(),
    instructions: "与えられた調査メモをそのまま返す。",
    model: fixedTextModel(text),
  });

const fixtureVoiceTool = (text: string) =>
  createTool({
    id: "voice-answer",
    description:
      "村の情報・最新情報・時事・天気など、事実にもとづく質問に答えるための要点を取得します。",
    inputSchema: z.object({
      question: z.string(),
      source: z.enum(["knowledge", "web"]).optional(),
    }),
    outputSchema: z.object({ answer: z.string() }),
    execute: async () => ({ answer: text }),
  });

export const createEvalTarget = (c: PersonaCase) => {
  const memo = fixtures[c.fixture ?? "none"];
  const intent = c.intent ?? "thinking";
  const platform = c.platform;

  const knowledge = fixtureAgent(knowledgeAgent, memo);
  const web = fixtureAgent(webResearcherAgent, memo);
  const emergency = fixtureAgent(emergencyReporterAgent, fixtures.emergency);

  const agents: Record<string, Agent> =
    platform === "widget"
      ? { knowledgeAgent: knowledge, webResearcherAgent: web }
      : platform === "voice"
        ? { emergencyReporterAgent: emergency }
        : {
            knowledgeAgent: knowledge,
            emergencyReporterAgent: emergency,
            webResearcherAgent: web,
          };

  const tools =
    platform === "voice"
      ? {
          [voiceAnswerToolName]: fixtureVoiceTool(memo),
          [endCallToolName]: endCallTool,
        }
      : undefined;

  const modelConfig =
    platform === "voice"
      ? voiceModelConfig
      : resolveModelTier({
          intent,
          platform: platform === "line" ? "line" : "web",
          isAdmin: false,
        });

  const memory = new Memory({
    storage: new LibSQLStore({ id: `eval-${c.id}`, url: ":memory:" }),
    options: { ...neppChanMemoryOptions(intent), generateTitle: false },
  });

  return {
    agent: createNeppChanAgent({
      platform,
      intent,
      modelConfig,
      siteInstructions: c.site?.instructions,
      currentPageUrl: c.site?.currentPageUrl,
      agents,
      ...(tools && { tools }),
      memory,
    }),
    memory,
    modelId: primaryModelId(modelConfig),
  };
};
