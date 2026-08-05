import { toDateString } from "~/lib/date";

export type VoicePeriod = "d7" | "m1" | "all";

// 暦週（月曜起点）だと月曜の朝に対象が空になるため、今日を含むローリング日数で切る
const PERIOD_DAYS: Record<Exclude<VoicePeriod, "all">, number> = {
  d7: 7,
  m1: 30,
};

export const rollingFrom = (now: Date, days: number) => {
  const from = new Date(now);
  from.setDate(from.getDate() - (days - 1));
  return toDateString(from);
};

export const periodRange = (period: VoicePeriod, now: Date = new Date()) =>
  period === "all" ? {} : { from: rollingFrom(now, PERIOD_DAYS[period]) };
