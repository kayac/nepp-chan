import { z } from "zod";
import type { Intent } from "~/lib/llm-models";
import { intentRouterAgent } from "~/mastra/agents/intent-router-agent";

const intentSchema = z.object({
  intent: z.enum(["casual", "normal", "thinking"]),
});

/**
 * ユーザーメッセージの意図を軽量モデル（intent-router-agent）で分類する。
 * 分類結果は resolveModelTier と組み合わせてメインエージェントのモデルティアを決定する。
 * 分類失敗時は "normal" にフォールバックする。
 */
export const classifyIntent = async (message: string): Promise<Intent> => {
  try {
    const result = await intentRouterAgent.generate(message, {
      structuredOutput: { schema: intentSchema },
    });
    return result.object?.intent ?? "normal";
  } catch {
    return "normal";
  }
};
