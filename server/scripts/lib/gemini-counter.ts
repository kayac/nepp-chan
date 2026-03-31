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
 * 並列安全: append-only ログ形式。各行が「日付,カウント,タイムスタンプ」で、
 * 読み取り時に当日分を合算する。fs.appendFileSync は OS レベルでアトミック。
 *
 * RPD リセットタイミング: PT 深夜 0:00（JST 17:00）
 */
import * as fs from "node:fs";
import * as path from "node:path";

export type GeminiKeyType = "main" | "eval";

const COUNTER_DIR = path.resolve("dataset/eval");

const logPath = (keyType: GeminiKeyType): string =>
  path.join(COUNTER_DIR, `.gemini-usage-${keyType}.log`);

/** 後方互換: 旧 JSON ファイル */
const legacyJsonPath = (keyType: GeminiKeyType): string =>
  path.join(COUNTER_DIR, `.gemini-usage-${keyType}.json`);
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

/** ログファイルから当日分のリクエスト数を集計 */
const readLog = (keyType: GeminiKeyType): GeminiUsage => {
  const today = getPTDate();
  const filePath = logPath(keyType);

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);

    let requests = 0;
    let lastUpdated = "";

    for (const line of lines) {
      const [date, countStr, timestamp] = line.split(",");
      if (date === today) {
        requests += Number(countStr) || 0;
        if (timestamp && timestamp > lastUpdated) {
          lastUpdated = timestamp;
        }
      }
    }

    return { periodDate: today, requests, lastUpdated };
  } catch {
    return { periodDate: today, requests: 0, lastUpdated: "" };
  }
};

/**
 * カウンターをインクリメント（並列安全）。
 * ログファイルに1行 append するだけなのでロック不要。
 */
export const incrementGeminiCounter = (
  count = 1,
  keyType: GeminiKeyType = "eval",
): GeminiUsage => {
  const today = getPTDate();
  const timestamp = new Date().toISOString();

  fs.mkdirSync(COUNTER_DIR, { recursive: true });
  fs.appendFileSync(logPath(keyType), `${today},${count},${timestamp}\n`);

  // 返り値は近似値（他プロセスの書き込みとのタイミングで多少ずれる）
  const usage = readLog(keyType);
  return usage;
};

/** 現在の消費量を取得 */
export const getGeminiUsage = (
  keyType: GeminiKeyType = "eval",
): GeminiUsage & { rpd: number } => {
  const usage = readLog(keyType);
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

/**
 * 古いログ行（当日以外）を削除してファイルサイズを抑える。
 * 日次で1回呼べば十分。
 */
export const compactLog = (keyType: GeminiKeyType): void => {
  const today = getPTDate();
  const filePath = logPath(keyType);

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const todayLines = raw
      .trim()
      .split("\n")
      .filter((line) => line.startsWith(today));
    fs.writeFileSync(
      filePath,
      todayLines.length > 0 ? `${todayLines.join("\n")}\n` : "",
    );
  } catch {
    // ファイルが存在しない場合は何もしない
  }
};

/** 旧 JSON ファイルが存在すれば log 形式に移行して削除 */
export const migrateLegacyCounter = (): void => {
  for (const keyType of ["main", "eval"] as const) {
    try {
      const jsonPath = legacyJsonPath(keyType);
      if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, "utf-8");
        const legacy = JSON.parse(raw) as GeminiUsage;
        if (legacy.requests > 0 && legacy.periodDate === getPTDate()) {
          // 当日分のみ移行（古い日付のデータは捨てる）
          fs.mkdirSync(COUNTER_DIR, { recursive: true });
          fs.appendFileSync(
            logPath(keyType),
            `${legacy.periodDate},${legacy.requests},${legacy.lastUpdated}\n`,
          );
        }
        fs.unlinkSync(jsonPath);
      }
    } catch {
      // 移行失敗は無視
    }
  }

  // 最古の旧ファイル
  try {
    if (fs.existsSync(LEGACY_COUNTER_PATH)) {
      fs.unlinkSync(LEGACY_COUNTER_PATH);
    }
  } catch {
    // 無視
  }
};
