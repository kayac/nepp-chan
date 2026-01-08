import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { PinoLogger } from "@mastra/loggers";
import { converterAgent } from "~/mastra/agents/converter-agent";
import { emergencyAgent } from "~/mastra/agents/emergency-agent";
import { knowledgeAgent } from "~/mastra/agents/knowledge-agent";
import { masterAgent } from "~/mastra/agents/master-agent";
import { nepChanAgent } from "~/mastra/agents/nepch-agent";
import { personaAgent } from "~/mastra/agents/persona-agent";
import { villageInfoAgent } from "~/mastra/agents/village-info-agent";
import { weatherAgent } from "~/mastra/agents/weather-agent";
import { webResearcherAgent } from "~/mastra/agents/web-researcher-agent";
import {
  completenessScorer,
  toolCallAppropriatenessScorer,
  translationScorer,
} from "~/mastra/scorers/weather-scorer";
import { weatherWorkflow } from "~/mastra/workflows/weather-workflow";

/**
 * Mastra Playground 用のインスタンス
 * アプリケーション側で利用する時は、各呼び出し箇所で new Mastra() を直接使用してください
 */
export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: {
    converterAgent,
    emergencyAgent,
    knowledgeAgent,
    masterAgent,
    nepChanAgent,
    personaAgent,
    villageInfoAgent,
    weatherAgent,
    webResearcherAgent,
  },
  scorers: {
    toolCallAppropriatenessScorer,
    completenessScorer,
    translationScorer,
  },
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
