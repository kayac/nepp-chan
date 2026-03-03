// Mastra 形式のモデル名（Agent の model プロパティに使用）
export const GEMINI_FLASH = "google/gemini-3-flash-preview";
export const GEMINI_FLASH_LITE = "google/gemini-2.5-flash-lite";
export const GEMINI_PRO = "google/gemini-2.5-pro";

// 埋め込みモデル
export const GEMINI_EMBEDDING = "gemini-embedding-001";

/**
 * Gemini Flash モデルと thinkingConfig を含む Agent 設定を返す
 * @param level - 思考レベル (デフォルト: "low")
 */
export const geminiModelWithThinking = (
  level: "high" | "medium" | "low" = "low",
) => ({
  model: GEMINI_FLASH,
  providerOptions: {
    google: {
      thinkingConfig: { thinkingLevel: level },
    },
  },
});
