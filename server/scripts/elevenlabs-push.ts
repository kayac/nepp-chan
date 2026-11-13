#!/usr/bin/env tsx
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getPlatformProxy } from "wrangler";
import {
  promptSettings,
  researchToolConfig,
  turnConfig,
} from "./elevenlabs-agent-config";
import { buildElevenLabsPrompt } from "./elevenlabs-prompt";

const main = async () => {
  const { env, dispose } = await getPlatformProxy<CloudflareBindings>({
    configPath: "wrangler.jsonc",
  });
  try {
    const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
    const prompt = buildElevenLabsPrompt();
    const agent = await client.conversationalAi.agents.update(
      env.ELEVENLABS_AGENT_ID,
      {
        conversationConfig: {
          agent: { prompt: { prompt, ...promptSettings } },
          turn: turnConfig,
        },
      },
    );
    const applied = agent.conversationConfig.agent?.prompt;
    console.log(
      `agent_id=${agent.agentId} prompt_chars=${applied?.prompt?.length ?? 0} temperature=${applied?.temperature} speculative_turn=${agent.conversationConfig.turn?.speculativeTurn}`,
    );

    const [toolId] = applied?.toolIds ?? [];
    const current = await client.conversationalAi.tools.get(toolId);
    if (current.toolConfig.type !== "webhook") {
      throw new Error(`tool ${toolId} is not the research webhook`);
    }
    const tool = await client.conversationalAi.tools.update(toolId, {
      toolConfig: researchToolConfig({
        url: current.toolConfig.apiSchema.url,
        toolSecret: env.ELEVENLABS_TOOL_SECRET,
      }),
    });
    console.log(`tool_id=${tool.id}`);
  } finally {
    await dispose();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
