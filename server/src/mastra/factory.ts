import { Mastra } from "@mastra/core/mastra";
import type { MastraStorage } from "@mastra/core/storage";
import { PinoLogger } from "@mastra/loggers";
import { Observability } from "@mastra/observability";
import { weatherAgent } from "./agents/weather-agent";
import {
  completenessScorer,
  toolCallAppropriatenessScorer,
  translationScorer,
} from "./scorers/weather-scorer";
import { weatherWorkflow } from "./workflows/weather-workflow";

export const createMastra = (storage: MastraStorage) =>
  new Mastra({
    workflows: { weatherWorkflow },
    agents: { weatherAgent },
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
    observability: new Observability({
      default: { enabled: true },
    }),
  });
