import type { LlmServiceTier } from "~/lib/llm-pricing";

// Mastra 形式のモデル名（Agent の model プロパティに使用）
export const OPENAI_MAIN = "openai/gpt-5.6-terra";
export const OPENAI_LITE = "openai/gpt-5.6-luna";
export const OPENAI_NANO = "openai/gpt-5.4-nano";

// 埋め込みモデル
export const GEMINI_EMBEDDING = "gemini-embedding-001";

// Web 検索は検索グラウンディングの無料枠と応答速度で Gemini を使う
export const GEMINI_GROUNDING = "google/gemini-flash-lite-latest";

// Gemini latest は RPD 制限対象のため、Eval は固定バージョンを使う
export const GEMINI_FLASH_EVAL = "google/gemini-2.5-flash-lite";

export type ReasoningEffort =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

type TextVerbosity = "low" | "medium" | "high";

// Gemini の thinkingLevel は minimal/low/medium/high のみで none と xhigh 以上が無い
const GOOGLE_THINKING_LEVEL = {
  none: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "high",
  max: "high",
} as const satisfies Record<ReasoningEffort, string>;

type OpenAIProviderOptions = {
  textVerbosity?: TextVerbosity;
  promptCacheKey?: string;
  serviceTier?: LlmServiceTier;
};

// providerOptions はモデル側の名前空間だけが読まれるため両方指定する
export const reasoningProviderOptions = (
  effort: ReasoningEffort,
  openaiOptions?: OpenAIProviderOptions,
) => ({
  openai: {
    reasoningEffort: effort,
    ...(openaiOptions?.textVerbosity && {
      textVerbosity: openaiOptions.textVerbosity,
    }),
    ...(openaiOptions?.promptCacheKey && {
      promptCacheKey: openaiOptions.promptCacheKey,
    }),
    ...(openaiOptions?.serviceTier && {
      serviceTier: openaiOptions.serviceTier,
    }),
  },
  google: {
    thinkingConfig: { thinkingLevel: GOOGLE_THINKING_LEVEL[effort] },
  },
});

// Agent 直下の providerOptions は型に存在せず黙って捨てられるため defaultOptions に入れる
export const modelWithReasoning = ({
  model = OPENAI_LITE,
  effort,
  maxSteps,
  promptCacheKey,
  serviceTier,
}: {
  model?: string;
  effort: ReasoningEffort;
  maxSteps?: number;
  promptCacheKey?: string;
  serviceTier?: LlmServiceTier;
}) => ({
  model,
  defaultOptions: {
    providerOptions: reasoningProviderOptions(effort, {
      promptCacheKey,
      serviceTier,
    }),
    ...(maxSteps !== undefined && { maxSteps }),
  },
});

export type Intent = "casual" | "thinking";

/**
 * id を省略すると Agent 構築時に randomUUID() が呼ばれ、モジュールグローバルで
 * 生成する Agent が workerd の起動を壊すため必ず明示する。
 */
const modelChain = ({
  primary,
  fallback,
  effort,
  textVerbosity,
  promptCacheKey,
}: {
  primary: string;
  fallback: string;
  effort: ReasoningEffort;
  textVerbosity?: TextVerbosity;
  promptCacheKey?: string;
}) => [
  {
    id: primary,
    model: primary,
    providerOptions: reasoningProviderOptions(effort, {
      textVerbosity,
      promptCacheKey,
    }),
    maxRetries: 1,
  },
  {
    id: fallback,
    model: fallback,
    providerOptions: reasoningProviderOptions(effort, {
      textVerbosity,
      promptCacheKey,
    }),
    maxRetries: 1,
  },
];

export type AgentModelConfig = {
  model: ReturnType<typeof modelChain>;
  defaultOptions: { maxSteps: number };
};

// ツール実行ループの上限（サブエージェント連鎖の暴走によるコスト事故の保険）
const MAX_STEPS = { casual: 5, thinking: 10 } as const;

const thinkingTier = (
  platform: "web" | "line",
  effort: ReasoningEffort,
): AgentModelConfig => ({
  model: modelChain({
    primary: OPENAI_LITE,
    fallback: OPENAI_MAIN,
    effort,
    textVerbosity: platform === "web" ? "high" : undefined,
    promptCacheKey: `nepp-chan-${platform}-thinking`,
  }),
  defaultOptions: { maxSteps: MAX_STEPS.thinking },
});

const casualTier = (platform: "web" | "line"): AgentModelConfig => ({
  model: modelChain({
    primary: OPENAI_LITE,
    fallback: OPENAI_MAIN,
    effort: "none",
    promptCacheKey: `nepp-chan-${platform}-casual`,
  }),
  defaultOptions: { maxSteps: MAX_STEPS.casual },
});

const MODEL_TIERS: Record<Intent, Record<"web" | "line", AgentModelConfig>> = {
  casual: {
    web: casualTier("web"),
    line: casualTier("line"),
  },
  thinking: {
    web: thinkingTier("web", "medium"),
    line: thinkingTier("line", "medium"),
  },
};

const VOICE_MAX_STEPS = 10;

export const deterministicModelConfig = {
  model: OPENAI_LITE,
  defaultOptions: {
    modelSettings: { temperature: 0 },
    providerOptions: reasoningProviderOptions("none"),
  },
};

export const voiceModelConfig: AgentModelConfig = {
  model: modelChain({
    primary: OPENAI_LITE,
    fallback: OPENAI_MAIN,
    effort: "low",
    promptCacheKey: "nepp-chan-voice",
  }),
  defaultOptions: { maxSteps: VOICE_MAX_STEPS },
};

/**
 * Intent・プラットフォーム・管理者フラグからモデル設定を解決する。
 * 管理者の thinking は分析用に reasoning を引き上げ、casual は管理ツール連鎖用に maxSteps だけ引き上げる
 */
export const resolveModelTier = ({
  intent,
  platform,
  isAdmin,
}: {
  intent: Intent;
  platform: "web" | "line";
  isAdmin: boolean;
}): AgentModelConfig => {
  if (isAdmin && intent === "thinking") {
    return thinkingTier(platform, "high");
  }
  const tier = MODEL_TIERS[intent][platform];
  if (isAdmin && tier.defaultOptions.maxSteps < MAX_STEPS.thinking) {
    return {
      ...tier,
      defaultOptions: { ...tier.defaultOptions, maxSteps: MAX_STEPS.thinking },
    };
  }
  return tier;
};

export const primaryModelId = (config: AgentModelConfig) =>
  config.model[0].model;
