// Mastra 形式のモデル名（Agent の model プロパティに使用）
export const GEMINI_FLASH = "google/gemini-flash-latest";
export const GEMINI_FLASH_LITE = "google/gemini-flash-lite-latest";
export const GEMINI_PRO = "google/gemini-2.5-pro";

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
