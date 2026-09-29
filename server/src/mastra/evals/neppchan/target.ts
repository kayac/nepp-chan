import type { ToolsInput } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { DISPLAY_TOOL_NAMES } from "@nepp-chan/shared/constants/display-tools";
import { z } from "zod";
import {
  primaryModelId,
  resolveModelTier,
  voiceModelConfig,
} from "~/lib/llm-models";
import {
  createNeppChanAgent,
  neppChanMemoryOptions,
} from "~/mastra/agents/nepp-chan-agent";
import { displayChartTool } from "~/mastra/tools/display-chart-tool";
import { displayTableTool } from "~/mastra/tools/display-table-tool";
import { displayTimelineTool } from "~/mastra/tools/display-timeline-tool";
import { endCallTool, endCallToolName } from "~/mastra/tools/end-call-tool";
import { researchToolName } from "~/mastra/tools/research-tool";
import { voiceAnswerToolName } from "~/mastra/tools/voice-answer-tool";
import { fixtures } from "./fixtures";
import type { PersonaCase } from "./schema";

const fixtureVoiceTool = (text: string) =>
  createTool({
    id: "voice-answer",
    description:
      "村の情報・最新情報・時事・天気など、事実にもとづく質問に答えるための要点を取得します。",
    inputSchema: z.object({ question: z.string() }),
    outputSchema: z.object({ answer: z.string() }),
    execute: async () => ({ answer: text }),
  });

const fixtureResearchTool = (text: string) =>
  createTool({
    id: "research-answer",
    description:
      "村のナレッジと配信、必要に応じて Web を調べ、質問に答えるための調査メモを返します。",
    inputSchema: z.object({ question: z.string() }),
    outputSchema: z.object({ memo: z.string() }),
    execute: async () => ({ memo: text }),
  });

export const createEvalTarget = (c: PersonaCase) => {
  const memo = fixtures[c.fixture ?? "none"];
  const intent = c.intent ?? "thinking";
  const platform = c.platform;

  const tools: ToolsInput =
    platform === "voice"
      ? {
          [voiceAnswerToolName]: fixtureVoiceTool(memo),
          [endCallToolName]: endCallTool,
        }
      : {
          [researchToolName]: fixtureResearchTool(memo),
          ...(platform === "web"
            ? {
                [DISPLAY_TOOL_NAMES.chart]: displayChartTool,
                [DISPLAY_TOOL_NAMES.table]: displayTableTool,
                [DISPLAY_TOOL_NAMES.timeline]: displayTimelineTool,
              }
            : {}),
        };

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
      tools,
      memory,
    }),
    memory,
    modelId: primaryModelId(modelConfig),
  };
};
