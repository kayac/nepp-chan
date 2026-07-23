import { Button } from "@nepp-chan/shared/ui/Button";

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
      className="backdrop:bg-(--bg-overlay) backdrop:backdrop-blur-[3px]"
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
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isDeleting}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "削除中..." : "削除"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
