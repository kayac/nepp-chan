import { LoadingText } from "@nepp-chan/shared/ui/Loading";
import { useKnowledgeFile } from "~/app/dashboard/hooks/useKnowledge";
import { Dialog } from "~/components/ui/Dialog";
import { ModalHeader } from "~/components/ui/ModalHeader";

type Props = {
  fileKey: string;
  onClose: () => void;
};

/**
 * ナレッジファイルの閲覧専用ビューア
 * 運用時はFileEditorに置き換え可能
 */
export const FileViewer = ({ fileKey, onClose }: Props) => {
  const { data, isLoading, error } = useKnowledgeFile(fileKey);

  if (isLoading) {
    return (
      <Dialog onClose={onClose} className="w-full max-w-4xl">
        <div className="bg-white rounded-xl p-6 mx-4">
          <div className="flex justify-center py-8">
            <LoadingText>読み込み中...</LoadingText>
          </div>
        </div>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog onClose={onClose} className="w-full max-w-4xl">
        <div className="bg-white rounded-xl p-6 mx-4">
          <div className="text-center py-8 text-red-500">
            エラー:{" "}
            {error instanceof Error ? error.message : "読み込みに失敗しました"}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-600 hover:text-stone-800"
            >
              閉じる
            </button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog onClose={onClose} className="w-full max-w-4xl">
      <div className="bg-white rounded-xl mx-4 max-h-[90dvh] flex flex-col">
        {/* ヘッダー */}
        <ModalHeader
          className="p-4 border-b border-(--border-1)"
          titleClassName="text-lg"
          onClose={onClose}
          title={fileKey}
        />

        {/* コンテンツ */}
        <div className="flex-1 overflow-auto p-4">
          <div className="prose prose-stone max-w-none whitespace-pre-wrap font-mono text-sm">
            {data?.content}
          </div>
        </div>

        {/* フッター */}
        <div className="flex justify-end p-4 border-t border-stone-200 bg-stone-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-stone-600 hover:text-stone-800"
          >
            閉じる
          </button>
        </div>
      </div>
    </Dialog>
  );
};
