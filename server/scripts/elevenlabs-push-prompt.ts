#!/usr/bin/env tsx
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getPlatformProxy } from "wrangler";
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
      { conversationConfig: { agent: { prompt: { prompt } } } },
    );
    console.log(
      `agent_id=${agent.agentId} prompt_chars=${agent.conversationConfig.agent?.prompt?.prompt?.length ?? 0}`,
    );
  } finally {
    await dispose();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
