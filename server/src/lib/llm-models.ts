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
