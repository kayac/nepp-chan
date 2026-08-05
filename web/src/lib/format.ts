export const formatDateTime = (dateStr: string) =>
  new Date(dateStr).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatMonthDay = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
  });

export const formatMonthDayTime = (dateStr: string) =>
  new Date(dateStr).toLocaleString("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
