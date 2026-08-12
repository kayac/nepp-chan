// Mastra 形式のモデル名（Agent の model プロパティに使用）
export const OPENAI_MAIN = "openai/gpt-5.6-terra";
export const OPENAI_LITE = "openai/gpt-5.6-luna";

export const OPENAI_SCORER = "openai/gpt-4.1-nano";

// 埋め込みモデル
export const GEMINI_EMBEDDING = "gemini-embedding-001";

// Google 検索グラウンディングは Gemini 専用機能のため web-researcher だけ Gemini を使う
export const GEMINI_GROUNDING = "google/gemini-flash-lite-latest";

type ReasoningEffort = "high" | "medium" | "low" | "minimal";

export const modelWithReasoning = ({
  model = OPENAI_LITE,
  effort = "low" as ReasoningEffort,
} = {}) => ({
  model,
  providerOptions: {
    openai: {
      reasoningEffort: effort,
    },
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
}: {
  primary: string;
  fallback: string;
  effort: ReasoningEffort;
}) => [
  {
    id: primary,
    ...modelWithReasoning({ model: primary, effort }),
    maxRetries: 1,
  },
  {
    id: fallback,
    ...modelWithReasoning({ model: fallback, effort }),
    maxRetries: 1,
  },
];

export type AgentModelConfig = {
  model: ReturnType<typeof modelChain>;
  defaultOptions: { maxSteps: number };
};

// ツール実行ループの上限（サブエージェント連鎖の暴走によるコスト事故の保険）
const MAX_STEPS = { casual: 5, thinking: 10 } as const;

const MODEL_TIERS: Record<Intent, Record<"web" | "line", AgentModelConfig>> = {
  casual: {
    web: {
      model: modelChain({
        primary: OPENAI_LITE,
        fallback: OPENAI_MAIN,
        effort: "low",
      }),
      defaultOptions: { maxSteps: MAX_STEPS.casual },
    },
    line: {
      model: modelChain({
        primary: OPENAI_LITE,
        fallback: OPENAI_MAIN,
        effort: "minimal",
      }),
      defaultOptions: { maxSteps: MAX_STEPS.casual },
    },
  },
  thinking: {
    web: {
      model: modelChain({
        primary: OPENAI_MAIN,
        fallback: OPENAI_LITE,
        effort: "high",
      }),
      defaultOptions: { maxSteps: MAX_STEPS.thinking },
    },
    line: {
      model: modelChain({
        primary: OPENAI_MAIN,
        fallback: OPENAI_LITE,
        effort: "medium",
      }),
      defaultOptions: { maxSteps: MAX_STEPS.thinking },
    },
  },
};

const VOICE_MAX_STEPS = 10;

export const voiceModelConfig: AgentModelConfig = {
  model: modelChain({
    primary: OPENAI_LITE,
    fallback: OPENAI_MAIN,
    effort: "low",
  }),
  defaultOptions: { maxSteps: VOICE_MAX_STEPS },
};

/**
 * Intent・プラットフォーム・管理者フラグからモデル設定を解決する
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
  if (isAdmin) {
    return MODEL_TIERS.thinking.web;
  }
  return MODEL_TIERS[intent][platform];
};

export const primaryModelId = (config: AgentModelConfig) =>
  config.model[0].model;
