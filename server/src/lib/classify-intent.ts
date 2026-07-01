import { z } from "zod";
import type { Intent } from "~/lib/llm-models";
import { intentRouterAgent } from "~/mastra/agents/intent-router-agent";

const intentSchema = z.object({
  intent: z.enum(["casual", "thinking"]),
});

// 質問を casual と誤判定すると検索なしの弱いティアで答えてしまうため、挨拶・相槌だけに厳格に限定する。
const CASUAL_ONLY =
  /^(?:(?:もしもし|こんにち(?:は|わ)|おはよう(?:ございます)?|こんばんは|やっほー|やあ|ねえ|ねぇ|はじめまして|よろしく(?:ね|おねがいします|お願いします)?|うん|ううん|そう(?:だね|なんだ|そっか)?|そっか|へえ|へー|ふーん|ほー|なるほど|ありがとう?(?:ございます)?|どうも|おやすみ(?:なさい)?|またね|バイバイ|ばいばい|じゃあね|じゃあ|わかった|わかりました|りょうかい|了解|オッケー|おっけー|オーケー|はーい|はい|いいよ|いいね|すごい|すごーい|うれしい|たのしい)[ねよなぁーっ〜、。!！,.\s]*)+$/u;

export const heuristicIntent = (message: string): Intent | null => {
  const trimmed = message.trim();
  if (trimmed.length === 0 || trimmed.length > 16) return null;
  if (/[?？]/u.test(trimmed)) return null;
  return CASUAL_ONLY.test(trimmed) ? "casual" : null;
};

/**
 * ユーザーメッセージの意図を分類する。明らかな casual はヒューリスティックで即断して
 * LLM 往復を省き、それ以外は軽量モデル（intent-router-agent）に委ねる。
 * 分類失敗時は "thinking" にフォールバックする。
 */
export const classifyIntent = async (message: string): Promise<Intent> => {
  const fast = heuristicIntent(message);
  if (fast) return fast;
  try {
    const result = await intentRouterAgent.generate(message, {
      structuredOutput: { schema: intentSchema },
    });
    return result.object?.intent ?? "thinking";
  } catch {
    return "thinking";
  }
};
