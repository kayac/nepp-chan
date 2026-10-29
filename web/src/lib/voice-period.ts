import { toDateString } from "~/lib/date";

export type VoicePeriod = "d7" | "m1" | "all";

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
