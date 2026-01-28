import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { PinoLogger } from "@mastra/loggers";
import {
  DefaultExporter,
  Observability,
  SamplingStrategyType,
} from "@mastra/observability";
import { getPlatformProxy } from "wrangler";
import { converterAgent } from "~/mastra/agents/converter-agent";
import { emergencyAgent } from "~/mastra/agents/emergency-agent";
import { emergencyReporterAgent } from "~/mastra/agents/emergency-reporter-agent";
import { feedbackAgent } from "~/mastra/agents/feedback-agent";
import { knowledgeAgent } from "~/mastra/agents/knowledge-agent";
import { nepChanAgent } from "~/mastra/agents/nepp-chan-agent";
import { personaAgent } from "~/mastra/agents/persona-agent";
import { personaAnalystAgent } from "~/mastra/agents/persona-analyst-agent";
import { weatherAgent } from "~/mastra/agents/weather-agent";
import { webResearcherAgent } from "~/mastra/agents/web-researcher-agent";
import {
  ragContextPrecisionScorer,
  ragContextRelevanceScorer,
  ragFaithfulnessScorer,
} from "~/mastra/scorers/rag-scorer";
import {
  completenessScorer,
  toolCallAppropriatenessScorer,
  translationScorer,
} from "~/mastra/scorers/weather-scorer";
import { weatherWorkflow } from "~/mastra/workflows/weather-workflow";

let cloudflareEnv: CloudflareBindings | null = null;

const getCloudflareEnv = async () => {
  if (cloudflareEnv) return cloudflareEnv;

  try {
    const { env } = await getPlatformProxy<CloudflareBindings>({
      remoteBindings: true,
    });
    cloudflareEnv = env;
    return env;
  } catch (error) {
    console.warn("Cloudflare bindings not available:", error);
    return null;
  }
};

/**
 * Mastra Playground 用のインスタンス
 * アプリケーション側で利用する時は、各呼び出し箇所で new Mastra() を直接使用してください
 */
export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: {
    converterAgent,
    emergencyAgent,
    emergencyReporterAgent,
    feedbackAgent,
    knowledgeAgent,
    nepChanAgent,
    personaAgent,
    personaAnalystAgent,
    weatherAgent,
    webResearcherAgent,
  },
  scorers: {
    toolCallAppropriatenessScorer,
    completenessScorer,
    translationScorer,
    ragFaithfulnessScorer,
    ragContextPrecisionScorer,
    ragContextRelevanceScorer,
  },
  observability: new Observability({
    configs: {
      default: {
        serviceName: "nepp-chan-agent",
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [new DefaultExporter()],
      },
    },
  }),
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: "file:mastra.db",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  server: {
    middleware: [
      async (c, next) => {
        const env = await getCloudflareEnv();
        if (env) {
          const requestContext = c.get("requestContext");
          requestContext.set("env", env);
        }
        await next();
      },
    ],
  },
});
