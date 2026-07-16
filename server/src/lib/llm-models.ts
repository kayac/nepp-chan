// Mastra 形式のモデル名（Agent の model プロパティに使用）
export const GEMINI_FLASH = "google/gemini-flash-latest";
export const GEMINI_FLASH_LITE = "google/gemini-flash-lite-latest";
export const GEMINI_PRO = "google/gemini-2.5-pro";

// Eval 全体テスト用（RPD 無制限、latest ではなくバージョン固定）
export const GEMINI_FLASH_EVAL = "google/gemini-2.5-flash-lite";

// Eval スコアラー専用モデル（Flash Lite は構造化出力で反復バグあり）
// https://github.com/google-gemini/cookbook/issues/449
export const GEMINI_SCORER = "google/gemini-2.5-flash";

// OpenAI eval スコアラー用（Gemini 構造化出力バグの代替）
export const OPENAI_SCORER = "openai/gpt-4.1-nano";

// 埋め込みモデル
export const GEMINI_EMBEDDING = "gemini-embedding-001";

type ThinkingLevel = "high" | "medium" | "low" | "none";

/**
 * Gemini モデルと thinkingConfig を含む Agent 設定を返す。
 * "none" は AI SDK の thinkingLevel enum に存在しないため thinkingBudget: 0 で無効化する。
 */
export const geminiModelWithThinking = ({
  model = GEMINI_FLASH_LITE,
  level = "low" as ThinkingLevel,
} = {}) => ({
  model,
  providerOptions: {
    google: {
      thinkingConfig:
        level === "none" ? { thinkingBudget: 0 } : { thinkingLevel: level },
    },
  },
});

export type Intent = "casual" | "thinking";

/**
 * プライマリ障害・レート制限時に同じ thinking 設定のままフォールバックする
 * モデル連鎖を返す。コスト暴発を避けるため PRO へはフォールバックしない。
 * id を省略すると Agent 構築時に randomUUID() が呼ばれ、モジュールグローバルで
 * 生成する Agent が workerd の起動を壊すため必ず明示する。
 */
const geminiModelChain = ({
  primary,
  fallback,
  level,
}: {
  primary: string;
  fallback: string;
  level: ThinkingLevel;
}) => [
  {
    id: primary,
    ...geminiModelWithThinking({ model: primary, level }),
    maxRetries: 1,
  },
  {
    id: fallback,
    ...geminiModelWithThinking({ model: fallback, level }),
    maxRetries: 1,
  },
];

export type AgentModelConfig = {
  model: ReturnType<typeof geminiModelChain>;
  defaultOptions: { maxSteps: number };
};

// ツール実行ループの上限（サブエージェント連鎖の暴走によるコスト事故の保険）
const MAX_STEPS = { casual: 5, thinking: 10 } as const;

const MODEL_TIERS: Record<Intent, Record<"web" | "line", AgentModelConfig>> = {
  casual: {
    web: {
      model: geminiModelChain({
        primary: GEMINI_FLASH_LITE,
        fallback: GEMINI_FLASH,
        level: "low",
      }),
      defaultOptions: { maxSteps: MAX_STEPS.casual },
    },
    line: {
      model: geminiModelChain({
        primary: GEMINI_FLASH_LITE,
        fallback: GEMINI_FLASH,
        level: "none",
      }),
      defaultOptions: { maxSteps: MAX_STEPS.casual },
    },
  },
  thinking: {
    web: {
      model: geminiModelChain({
        primary: GEMINI_FLASH,
        fallback: GEMINI_FLASH_LITE,
        level: "high",
      }),
      defaultOptions: { maxSteps: MAX_STEPS.thinking },
    },
    line: {
      model: geminiModelChain({
        primary: GEMINI_FLASH,
        fallback: GEMINI_FLASH_LITE,
        level: "medium",
      }),
      defaultOptions: { maxSteps: MAX_STEPS.thinking },
    },
  },
};

const VOICE_MAX_STEPS = 10;

export const voiceModelConfig: AgentModelConfig = {
  model: geminiModelChain({
    primary: GEMINI_FLASH_LITE,
    fallback: GEMINI_FLASH,
    level: "low",
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
