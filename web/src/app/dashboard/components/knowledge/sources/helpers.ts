import type { ApprovalStatus, KnowledgeSource } from "~/types";

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  pending: "未承認",
  approved: "公開中",
  rejected: "却下済み",
  disabled: "停止中",
};

export const APPROVAL_BADGE_CLASS: Record<ApprovalStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-teal-100 text-teal-700",
  rejected: "bg-stone-100 text-stone-500",
  disabled: "bg-red-100 text-red-700",
};

export const availableActions = (status: ApprovalStatus) =>
  status === "approved"
    ? (["disable"] as const)
    : (["approve", "reject"] as const);

export const ACTION_LABELS = {
  approve: "承認して検索対象にする",
  reject: "却下する",
  disable: "検索対象から外す",
} as const;

export const countByStatus = (
  sources: KnowledgeSource[],
  status: ApprovalStatus,
) => sources.filter((source) => source.approvalStatus === status).length;
