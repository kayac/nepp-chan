import { useState } from "react";
import {
  useDeleteFile,
  useDeleteKnowledge,
  useKnowledgeFiles,
  useSyncKnowledge,
} from "~/hooks/useDashboard";
import { FileEditor, FileList, FileUpload } from "./knowledge";

export const KnowledgePanel = () => {
  const [message, setMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);

  const { data: filesData, isLoading, error, refetch } = useKnowledgeFiles();
  const syncMutation = useSyncKnowledge();
  const deleteAllMutation = useDeleteKnowledge();
  const deleteFileMutation = useDeleteFile();

  const handleSync = async () => {
    setMessage(null);
    try {
      const result = await syncMutation.mutateAsync();
      const syncedCount = result.results?.length ?? 0;
      const editedFiles =
        result.results?.filter((r) => r.edited).map((r) => r.file) ?? [];

      if (editedFiles.length > 0) {
        setMessage({
          type: "warning",
          text: `同期完了: ${syncedCount} ファイル（編集済み: ${editedFiles.join(", ")}）`,
        });
      } else {
        setMessage({
          type: "success",
          text: `同期完了: ${syncedCount} ファイル`,
        });
      }
      refetch();
    } catch (err) {
      setMessage({
        type: "error",
        text: `同期失敗: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        "全てのナレッジファイルを削除しますか？\nR2 と Vectorize の両方から削除されます。この操作は取り消せません。",
      )
    ) {
      return;
    }
    setMessage(null);
    try {
      const result = await deleteAllMutation.mutateAsync();
      setMessage({
        type: "success",
        text: `削除完了: ${result.count ?? 0} 件`,
      });
      refetch();
    } catch (err) {
      setMessage({
        type: "error",
        text: `削除失敗: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  };

  const handleDeleteFile = async (key: string, edited?: boolean) => {
    const confirmMessage = edited
      ? `${key} は編集済みです。削除すると編集内容が失われます。\n削除しますか？`
      : `${key} を削除しますか？`;
    if (!confirm(confirmMessage)) {
      return;
    }
    setMessage(null);
    try {
      await deleteFileMutation.mutateAsync(key);
      setMessage({
        type: "success",
        text: `${key} を削除しました`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: `削除失敗: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  };

  const isMutating =
    syncMutation.isPending ||
    deleteAllMutation.isPending ||
    deleteFileMutation.isPending;

  return (
    <div className="space-y-6">
      {/* アップロードセクション */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-bold text-stone-800 mb-4">
          ファイルアップロード
        </h2>
        <FileUpload onSuccess={() => refetch()} />
      </div>

      {/* ファイル一覧セクション */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-bold text-stone-800 mb-4">ファイル一覧</h2>

        {isLoading && (
          <div className="text-center py-8 text-stone-500">読み込み中...</div>
        )}

        {error && (
          <div className="text-center py-8 text-red-500">
            エラー:{" "}
            {error instanceof Error ? error.message : "読み込みに失敗しました"}
          </div>
        )}

        {filesData && (
          <FileList
            files={filesData.files}
            onEdit={(key) => setEditingFile(key)}
            onDelete={handleDeleteFile}
            isDeleting={deleteFileMutation.isPending}
          />
        )}
      </div>

      {/* 管理セクション */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-bold text-stone-800 mb-4">ナレッジ管理</h2>

        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : message.type === "warning"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSync}
            disabled={isMutating}
            className="px-4 py-2 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {syncMutation.isPending ? "同期中..." : "全ファイル同期"}
          </button>
          <button
            type="button"
            onClick={handleDeleteAll}
            disabled={isMutating}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {deleteAllMutation.isPending ? "削除中..." : "全ファイル削除"}
          </button>
        </div>
      </div>

      {/* エディタモーダル */}
      {editingFile && (
        <FileEditor
          fileKey={editingFile}
          onClose={() => setEditingFile(null)}
        />
      )}
    </div>
  );
};
