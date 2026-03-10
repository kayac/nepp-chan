// Mastra 形式のモデル名（Agent の model プロパティに使用）
export const GEMINI_FLASH = "google/gemini-flash-lite-latest";
export const GEMINI_FLASH_LITE = "google/gemini-2.5-flash-lite";
export const GEMINI_PRO = "google/gemini-2.5-pro";

// Eval スコアラー専用モデル（Flash Lite は構造化出力で反復バグあり）
// https://github.com/google-gemini/cookbook/issues/449
export const GEMINI_SCORER = "google/gemini-2.5-flash";

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
