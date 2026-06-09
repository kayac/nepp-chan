import { Dialog } from "~/components/ui/Dialog";

type Props = {
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ThreadDeleteModal = ({
  isDeleting,
  onConfirm,
  onCancel,
}: Props) => {
  return (
    <Dialog
      onClose={onCancel}
      className="backdrop:bg-stone-900/30 backdrop:backdrop-blur-[3px]"
    >
      <div
        className="bg-(--paper-0) rounded-2xl p-6 w-80 border border-(--paper-200)"
        style={{ boxShadow: "var(--shadow-float-lg)" }}
      >
        <h2 className="text-base font-semibold text-(--fg-1) mb-2 font-(family-name:--font-display)">
          スレッドを削除
        </h2>
        <p className="text-sm text-(--fg-2) mb-6">
          このスレッドを削除しますか？会話履歴は復元できません。
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-(--fg-2) hover:bg-(--paper-100) rounded-lg transition-colors disabled:opacity-60"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60"
          >
            {isDeleting ? "削除中..." : "削除"}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
