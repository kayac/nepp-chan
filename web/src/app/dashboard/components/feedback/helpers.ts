import type { MessageFeedback } from "~/types";

export type ResolvedFilter = "all" | "unresolved" | "resolved";

export const filterFeedbacksByResolved = (
  feedbacks: readonly MessageFeedback[],
  filter: ResolvedFilter,
): MessageFeedback[] => {
  if (filter === "unresolved") return feedbacks.filter((f) => !f.resolvedAt);
  if (filter === "resolved") return feedbacks.filter((f) => !!f.resolvedAt);
  return [...feedbacks];
};

export type ResolvedCounts = {
  unresolved: number;
  resolved: number;
};

export const countResolvedAndUnresolved = (
  feedbacks: readonly MessageFeedback[],
): ResolvedCounts => ({
  unresolved: feedbacks.filter((f) => !f.resolvedAt).length,
  resolved: feedbacks.filter((f) => !!f.resolvedAt).length,
});
