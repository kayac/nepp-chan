/**
 * 現在の日時情報を生成する（JST）
 * エージェントの instructions に注入して使用
 */
export const getCurrentDateInfo = () => {
  const now = new Date();
  const jst = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  return `今日は${jst.format(now)}です。`;
};
