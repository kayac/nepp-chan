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
