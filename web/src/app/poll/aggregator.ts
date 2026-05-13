import type { PollChoiceResult } from "~/types";

export const maxChoiceCount = (results: PollChoiceResult[]): number =>
  Math.max(...results.map((cr) => cr.count), 0);

export const isLeadingChoice = (
  result: PollChoiceResult,
  maxCount: number,
): boolean => result.count === maxCount && maxCount > 0;
