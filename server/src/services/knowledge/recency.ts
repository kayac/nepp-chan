import { DAY_MS, jstDateToUtc } from "~/lib/date";

const DECAY_DAYS = 365;
const UNKNOWN_DATE_SCORE = 0.5;

export const recencyScore = (
  date: string | undefined,
  dateType: string | undefined,
  now: Date,
) => {
  if (dateType === "evergreen") return 1;
  if (!date) return UNKNOWN_DATE_SCORE;
  const time = jstDateToUtc(date).getTime();
  if (Number.isNaN(time)) return UNKNOWN_DATE_SCORE;
  const ageDays = (now.getTime() - time) / DAY_MS;
  if (ageDays <= 0) return 1;
  return Math.exp(-ageDays / DECAY_DAYS);
};

type Dated = { score: number; date?: string; dateType?: string };

export const boostByRecency = <T extends Dated>(
  items: T[],
  now: Date,
  weight: number,
) =>
  items
    .map((item) => ({
      ...item,
      score:
        (item.score + weight * recencyScore(item.date, item.dateType, now)) /
        (1 + weight),
    }))
    .sort((a, b) => b.score - a.score);
