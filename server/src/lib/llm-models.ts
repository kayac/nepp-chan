// Mastra 形式のモデル名（Agent の model プロパティに使用）
export const GEMINI_FLASH = "google/gemini-flash-latest";
export const GEMINI_FLASH_LITE = "google/gemini-flash-lite-latest";
export const GEMINI_PRO = "google/gemini-2.5-pro";

// Eval スコアラー専用モデル（Flash Lite は構造化出力で反復バグあり）
// https://github.com/google-gemini/cookbook/issues/449
export const GEMINI_SCORER = "google/gemini-2.5-flash";

// 埋め込みモデル
export const GEMINI_EMBEDDING = "gemini-embedding-001";

/**
 * Gemini モデルと thinkingConfig を含む Agent 設定を返す
 */
export const geminiModelWithThinking = ({
  model = GEMINI_FLASH_LITE,
  level = "low" as "high" | "medium" | "low",
} = {}) => ({
  model,
  providerOptions: {
    google: {
      thinkingConfig: { thinkingLevel: level },
    },
  },
});

export type Intent = "casual" | "normal" | "thinking";

export type ModelTierConfig = ReturnType<typeof geminiModelWithThinking>;

const MODEL_TIERS: Record<Intent, Record<"web" | "line", ModelTierConfig>> = {
  casual: {
    web: geminiModelWithThinking({ model: GEMINI_FLASH_LITE, level: "low" }),
    line: geminiModelWithThinking({ model: GEMINI_FLASH_LITE, level: "low" }),
  },
  normal: {
    web: geminiModelWithThinking({ model: GEMINI_FLASH, level: "medium" }),
    line: geminiModelWithThinking({
      model: GEMINI_FLASH_LITE,
      level: "medium",
    }),
  },
  thinking: {
    web: geminiModelWithThinking({ model: GEMINI_FLASH, level: "high" }),
    line: geminiModelWithThinking({ model: GEMINI_FLASH, level: "medium" }),
  },
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
}): ModelTierConfig => {
  if (isAdmin) {
    return MODEL_TIERS.thinking.web;
  }
  return MODEL_TIERS[intent][platform];
};
