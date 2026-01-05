import { useState } from "react";
import {
  useDeleteFile,
  useReconvertFile,
  useUnifiedFiles,
} from "~/hooks/useDashboard";
import { FileEditor, FileList, FileUpload } from "./knowledge";

export const KnowledgePanel = () => {
  const [message, setMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);

  const { data: filesData, isLoading, error } = useUnifiedFiles();
  const deleteFileMutation = useDeleteFile();
  const reconvertMutation = useReconvertFile();

  const handleDeleteFile = (baseName: string) => {
    if (
      !confirm(
        `${baseName} を完全に削除しますか？\n（Markdown、元ファイル、ベクトルデータがすべて削除されます）`,
      )
    ) {
      return;
    }
    setMessage(null);
    deleteFileMutation.mutate(`${baseName}.md`, {
      onSuccess: () => {
        setMessage({
          type: "success",
          text: `${baseName} を削除しました`,
        });
      },
      onError: (err) => {
        setMessage({
          type: "error",
          text: `削除失敗: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      },
    });
  };

  const handleReconvert = (originalKey: string, baseName: string) => {
    setMessage(null);
    reconvertMutation.mutate(
      { originalKey, filename: baseName },
      {
        onSuccess: (result) => {
          setMessage({
            type: "success",
            text: `${result.key} を生成しました（${result.chunks}チャンク）`,
          });
        },
        onError: (err) => {
          setMessage({
            type: "error",
            text: `変換失敗: ${err instanceof Error ? err.message : "Unknown error"}`,
          });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* アップロードセクション */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-bold text-stone-800 mb-4">
          ファイルアップロード
        </h2>
        <FileUpload onSuccess={() => {}} />
      </div>

      {/* ファイル一覧セクション */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-bold text-stone-800 mb-4">ファイル一覧</h2>

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
            onReconvert={handleReconvert}
            isDeleting={deleteFileMutation.isPending}
            isReconverting={reconvertMutation.isPending}
          />
        )}
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
