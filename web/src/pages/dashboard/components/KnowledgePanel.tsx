import { useState } from "react";
import {
  useDeleteFile,
  useDeleteKnowledge,
  useKnowledgeFiles,
} from "~/hooks/useDashboard";
import { FileEditor, FileList, FileUpload } from "./knowledge";

export const KnowledgePanel = () => {
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);

  const { data: filesData, isLoading, error, refetch } = useKnowledgeFiles();
  const deleteAllMutation = useDeleteKnowledge();
  const deleteFileMutation = useDeleteFile();

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

  const handleDeleteFile = async (key: string) => {
    if (!confirm(`${key} を削除しますか？`)) {
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
    deleteAllMutation.isPending || deleteFileMutation.isPending;

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
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="button"
          onClick={handleDeleteAll}
          disabled={isMutating}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {deleteAllMutation.isPending ? "削除中..." : "全ファイル削除"}
        </button>
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
