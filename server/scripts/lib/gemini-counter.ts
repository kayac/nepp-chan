/**
 * Gemini API リクエストカウンター
 *
 * Gemini API はレスポンスヘッダーで残余クォータを返さないため、
 * ローカルファイルでリクエスト数を追跡する。
 *
 * キー種別ごとに別ファイルで管理:
 * - main: GOOGLE_GENERATIVE_AI_API_KEY（本番会話用）
 * - eval: EVAL_GOOGLE_API_KEY（eval 専用）
 *
 * RPD リセットタイミング: PT 深夜 0:00（JST 17:00）
 */
import * as fs from "node:fs";
import * as path from "node:path";

export type GeminiKeyType = "main" | "eval";

const COUNTER_DIR = path.resolve(
  import.meta.dirname,
  "../../../dataset/eval",
);

const counterPath = (keyType: GeminiKeyType): string =>
  path.join(COUNTER_DIR, `.gemini-usage-${keyType}.json`);

/** 後方互換: 旧ファイル名 */
const LEGACY_COUNTER_PATH = path.join(COUNTER_DIR, ".gemini-usage.json");

interface GeminiUsage {
  /** RPD リセット周期の識別子（PT タイムゾーンの日付） */
  periodDate: string;
  /** 累計リクエスト数 */
  requests: number;
  /** 最終更新日時（ISO） */
  lastUpdated: string;
}

/** PT（UTC-8）ベースの日付文字列を返す。RPD リセットは PT 深夜 0:00 */
const getPTDate = (): string => {
  const now = new Date();
  const pt = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  return pt.toISOString().slice(0, 10);
};

const readCounter = (keyType: GeminiKeyType): GeminiUsage => {
  try {
    const raw = fs.readFileSync(counterPath(keyType), "utf-8");
    return JSON.parse(raw) as GeminiUsage;
  } catch {
    return { periodDate: getPTDate(), requests: 0, lastUpdated: "" };
  }
};

const writeCounter = (keyType: GeminiKeyType, usage: GeminiUsage): void => {
  fs.mkdirSync(COUNTER_DIR, { recursive: true });
  fs.writeFileSync(counterPath(keyType), JSON.stringify(usage, null, 2));
};

/** カウンターをインクリメント。日付が変わっていたら自動リセット */
export const incrementGeminiCounter = (
  count = 1,
  keyType: GeminiKeyType = "eval",
): GeminiUsage => {
  const usage = readCounter(keyType);
  const today = getPTDate();

  if (usage.periodDate !== today) {
    usage.periodDate = today;
    usage.requests = 0;
  }

  usage.requests += count;
  usage.lastUpdated = new Date().toISOString();
  writeCounter(keyType, usage);
  return usage;
};

/** 現在の消費量を取得 */
export const getGeminiUsage = (
  keyType: GeminiKeyType = "eval",
): GeminiUsage & { rpd: number } => {
  const usage = readCounter(keyType);
  const today = getPTDate();

  if (usage.periodDate !== today) {
    return { periodDate: today, requests: 0, lastUpdated: "", rpd: 10_000 };
  }

  return { ...usage, rpd: 10_000 };
};

/** 全キー種別の消費量をまとめて取得 */
export const getAllGeminiUsage = (): Record<
  GeminiKeyType,
  GeminiUsage & { rpd: number }
> => ({
  main: getGeminiUsage("main"),
  eval: getGeminiUsage("eval"),
});

/** 旧ファイルが存在すれば eval に移行して削除 */
export const migrateLegacyCounter = (): void => {
  try {
    if (fs.existsSync(LEGACY_COUNTER_PATH)) {
      const raw = fs.readFileSync(LEGACY_COUNTER_PATH, "utf-8");
      const legacy = JSON.parse(raw) as GeminiUsage;
      // 旧カウンターは eval 用途でしか使っていなかった
      const evalUsage = readCounter("eval");
      if (evalUsage.requests === 0) {
        writeCounter("eval", legacy);
      }
      fs.unlinkSync(LEGACY_COUNTER_PATH);
    }
  } catch {
    // 移行失敗は無視
  }
};
