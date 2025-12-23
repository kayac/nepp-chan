import { Mastra } from "@mastra/core/mastra";
import type { MastraStorage } from "@mastra/core/storage";
import { PinoLogger } from "@mastra/loggers";
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

export const createMastra = (storage: MastraStorage) =>
  new Mastra({
    workflows: { weatherWorkflow },
    agents: {
      weatherAgent,
      nepChanAgent,
      webResearcherAgent,
      villageInfoAgent,
      masterAgent,
      personaAgent,
    },
    scorers: {
      toolCallAppropriatenessScorer,
      completenessScorer,
      translationScorer,
    },
    storage,
    logger: new PinoLogger({
      name: "Mastra",
      level: "info",
    }),
  });
