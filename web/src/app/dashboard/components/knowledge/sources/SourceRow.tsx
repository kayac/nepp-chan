import { confirmDialog } from "~/lib/dialog";
import { formatDateTime } from "~/lib/format";
import type { ApprovalStatus, KnowledgeSource } from "~/types";
import {
  ACTION_LABELS,
  APPROVAL_BADGE_CLASS,
  APPROVAL_LABELS,
  availableActions,
} from "./helpers";

type Action = "approve" | "reject" | "disable";

type Props = {
  source: KnowledgeSource;
  isPending: boolean;
  onAction: (action: Action) => void;
};

const CONFIRM_MESSAGES: Record<Action, string> = {
  approve: "この情報源を検索対象に加えますか？",
  reject: "この情報源を却下しますか？検索対象から外れます。",
  disable:
    "この情報源を検索対象から外しますか？紐づく訂正は要再確認になります。",
};

export const SourceRow = ({ source, isPending, onAction }: Props) => {
  const status = source.approvalStatus as ApprovalStatus;

  const handleAction = (action: Action) => {
    if (!confirmDialog(CONFIRM_MESSAGES[action])) return;
    onAction(action);
  };

  return (
    <div
      className={`bg-white rounded-xl border border-stone-200 p-4 space-y-2 ${
        status === "rejected" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs text-stone-600 break-all">
          {source.sourcePath}
        </span>
        <span
          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${APPROVAL_BADGE_CLASS[status]}`}
        >
          {APPROVAL_LABELS[status]}
        </span>
        <span className="text-xs text-stone-400 ml-auto whitespace-nowrap">
          {source.chunkCount} チャンク
          {source.indexedAt && ` ・ ${formatDateTime(source.indexedAt)} 反映`}
        </span>
      </div>

      {source.canonicalUrl && (
        <a
          href={source.canonicalUrl}
          target="_blank"
          rel="noreferrer"
          className="block text-xs text-teal-600 hover:text-teal-700 hover:underline break-all"
        >
          {source.canonicalUrl}
        </a>
      )}

      <div className="flex gap-2 flex-wrap">
        {availableActions(status).map((action) => (
          <button
            key={action}
            type="button"
            disabled={isPending}
            onClick={() => handleAction(action)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors ${
              action === "approve"
                ? "bg-teal-600 text-white hover:bg-teal-700"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>
    </div>
  );
};
