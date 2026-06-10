const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;
const JST_OFFSET_MS = 9 * HOUR_MS;

/** JST の YYYY-MM-DD ラベルに変換する */
export const jstDateLabel = (date: Date) =>
  new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);

/** JST の日付ラベル（YYYY-MM-DD）をその日 00:00 の UTC Date に変換する */
export const jstDateToUtc = (label: string) =>
  new Date(`${label}T00:00:00+09:00`);

/** JST のその日 00:00 を UTC Date で返す */
export const startOfJstDay = (date: Date) => jstDateToUtc(jstDateLabel(date));

/** JST のその週の月曜 00:00 を UTC Date で返す */
export const startOfJstWeek = (date: Date) => {
  const jstDayOfWeek = new Date(date.getTime() + JST_OFFSET_MS).getUTCDay();
  const daysSinceMonday = (jstDayOfWeek + 6) % 7;
  return startOfJstDay(new Date(date.getTime() - daysSinceMonday * DAY_MS));
};

/**
 * 現在の日時情報を生成する（JST）
 * エージェントの instructions に注入して使用
 */
export const getCurrentDateInfo = () => {
  const now = new Date();
  const dateFormat = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const timeFormat = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `今日は${dateFormat.format(now)}、現在${timeFormat.format(now)}です。`;
};
