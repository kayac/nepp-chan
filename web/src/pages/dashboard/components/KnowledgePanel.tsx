import { useState } from "react";
import { useDeleteKnowledge, useSyncKnowledge } from "~/hooks/useDashboard";

export const KnowledgePanel = () => {
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const syncMutation = useSyncKnowledge();
  const deleteMutation = useDeleteKnowledge();

  const handleSync = async () => {
    setMessage(null);
    try {
      const result = await syncMutation.mutateAsync();
      const syncedCount = result.results?.length ?? 0;
      setMessage({
        type: "success",
        text: `同期完了: ${syncedCount} 件`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: `同期失敗: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm("全てのナレッジを削除しますか？この操作は取り消せません。")) {
      return;
    }
    setMessage(null);
    try {
      const result = await deleteMutation.mutateAsync();
      setMessage({
        type: "success",
        text: `削除完了: ${result.count ?? 0} 件`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: `削除失敗: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  };

  const isLoading = syncMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-bold text-stone-800 mb-4">ナレッジ管理</h2>
        <p className="text-sm text-stone-600 mb-6">
          R2 に保存された Markdown ファイルを Vectorize に同期します。
        </p>

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

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSync}
            disabled={isLoading}
            className="px-4 py-2 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {syncMutation.isPending ? "同期中..." : "同期実行"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {deleteMutation.isPending ? "削除中..." : "全削除"}
          </button>
        </div>
      </div>
    </div>
  );
};
