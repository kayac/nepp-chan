// Mastra 形式のモデル名（Agent の model プロパティに使用）
export const OPENAI_MAIN = "openai/gpt-5.6-terra";
export const OPENAI_LITE = "openai/gpt-5.6-luna";

// 最軽量モデル。非 reasoning のため temperature 指定が有効（決定的な分類・スコアリング向け）
export const OPENAI_NANO = "openai/gpt-4.1-nano";

// 埋め込みモデル
export const GEMINI_EMBEDDING = "gemini-embedding-001";

// Google 検索グラウンディングは Gemini 専用機能のため web-researcher だけ Gemini を使う
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

// providerOptions はモデル側の名前空間だけが読まれるため両方指定する
export const reasoningProviderOptions = (
  effort: ReasoningEffort,
  textVerbosity?: TextVerbosity,
) => ({
  openai: {
    reasoningEffort: effort,
    ...(textVerbosity && { textVerbosity }),
  },
  google: {
    thinkingConfig: { thinkingLevel: GOOGLE_THINKING_LEVEL[effort] },
  },
});

// Agent 直下の providerOptions は型に存在せず黙って捨てられるため defaultOptions に入れる
export const modelWithReasoning = ({
  model = OPENAI_LITE,
  effort = "high" as ReasoningEffort,
  maxSteps,
}: {
  model?: string;
  effort?: ReasoningEffort;
  maxSteps?: number;
} = {}) => ({
  model,
  defaultOptions: {
    providerOptions: reasoningProviderOptions(effort),
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
}: {
  primary: string;
  fallback: string;
  effort: ReasoningEffort;
  textVerbosity?: TextVerbosity;
}) => [
  {
    id: primary,
    model: primary,
    providerOptions: reasoningProviderOptions(effort, textVerbosity),
    maxRetries: 1,
  },
  {
    id: fallback,
    model: fallback,
    providerOptions: reasoningProviderOptions(effort, textVerbosity),
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
        effort: "medium",
      }),
      defaultOptions: { maxSteps: MAX_STEPS.casual },
    },
    line: {
      model: modelChain({
        primary: OPENAI_LITE,
        fallback: OPENAI_MAIN,
        effort: "medium",
      }),
      defaultOptions: { maxSteps: MAX_STEPS.casual },
    },
  },
  thinking: {
    web: {
      model: modelChain({
        primary: OPENAI_LITE,
        fallback: OPENAI_MAIN,
        effort: "xhigh",
        textVerbosity: "high",
      }),
      defaultOptions: { maxSteps: MAX_STEPS.thinking },
    },
    line: {
      model: modelChain({
        primary: OPENAI_LITE,
        fallback: OPENAI_MAIN,
        effort: "xhigh",
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
 * Intent・プラットフォーム・管理者フラグからモデル設定を解決する。
 * 管理者は管理ツールを連鎖的に呼ぶため、casual でも thinking と同じ maxSteps を与える
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
