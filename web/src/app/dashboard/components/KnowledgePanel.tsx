import { useState } from "react";
import {
  CuratedComposer,
  FileEditor,
  FileList,
  FileViewer,
} from "~/app/dashboard/components/knowledge";
import {
  useDeleteFile,
  useUnifiedFiles,
} from "~/app/dashboard/hooks/useKnowledge";

export const KnowledgePanel = () => {
  const { data: filesData, isLoading, error } = useUnifiedFiles();
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const deleteFileMutation = useDeleteFile();

  const existingKeys =
    filesData?.files.flatMap((f) => (f.markdown ? [f.markdown.key] : [])) ?? [];

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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-bold text-stone-800 mb-4">
          ナレッジを追加
        </h2>
        <CuratedComposer existingKeys={existingKeys} />
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-bold text-stone-800 mb-4">ファイル一覧</h2>

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
            onView={(key) => setViewingFile(key)}
            onEdit={(key) => setEditingFile(key)}
            onDelete={handleDeleteFile}
            isDeleting={deleteFileMutation.isPending}
          />
        )}
      </div>

      {viewingFile && (
        <FileViewer
          fileKey={viewingFile}
          onClose={() => setViewingFile(null)}
        />
      )}

      {editingFile && (
        <FileEditor
          fileKey={editingFile}
          onClose={() => setEditingFile(null)}
        />
      )}
    </div>
  );
};
