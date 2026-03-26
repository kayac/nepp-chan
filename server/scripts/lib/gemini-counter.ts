/**
 * Gemini API リクエストカウンター
 *
 * Gemini API はレスポンスヘッダーで残余クォータを返さないため、
 * ローカルファイルでリクエスト数を追跡する。
 *
 * RPD リセットタイミング: PT 深夜 0:00（JST 17:00）
 */
import * as fs from "node:fs";
import * as path from "node:path";

const COUNTER_PATH = path.resolve(
  import.meta.dirname,
  "../../../dataset/eval/.gemini-usage.json",
);

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

const readCounter = (): GeminiUsage => {
  try {
    const raw = fs.readFileSync(COUNTER_PATH, "utf-8");
    return JSON.parse(raw) as GeminiUsage;
  } catch {
    return { periodDate: getPTDate(), requests: 0, lastUpdated: "" };
  }
};

const writeCounter = (usage: GeminiUsage): void => {
  fs.mkdirSync(path.dirname(COUNTER_PATH), { recursive: true });
  fs.writeFileSync(COUNTER_PATH, JSON.stringify(usage, null, 2));
};

/** カウンターをインクリメント。日付が変わっていたら自動リセット */
export const incrementGeminiCounter = (count = 1): GeminiUsage => {
  const usage = readCounter();
  const today = getPTDate();

  if (usage.periodDate !== today) {
    // RPD リセット
    usage.periodDate = today;
    usage.requests = 0;
  }

  usage.requests += count;
  usage.lastUpdated = new Date().toISOString();
  writeCounter(usage);
  return usage;
};

/** 現在の消費量を取得 */
export const getGeminiUsage = (): GeminiUsage & { rpd: number } => {
  const usage = readCounter();
  const today = getPTDate();

  if (usage.periodDate !== today) {
    return { periodDate: today, requests: 0, lastUpdated: "", rpd: 10_000 };
  }

  return { ...usage, rpd: 10_000 };
};
