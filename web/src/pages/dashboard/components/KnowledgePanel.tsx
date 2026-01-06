import { useState } from "react";
import { useDeleteFile, useUnifiedFiles } from "~/hooks/useDashboard";
import { FileList, FileViewer } from "./knowledge";

/**
 * ナレッジ管理パネル
 *
 * NOTE: アップロード・編集機能は一時的に無効化
 * 運用フェーズで必要に応じて復活させる
 * 関連コンポーネント: FileUpload, FileEditor
 */
export const KnowledgePanel = () => {
  const { data: filesData, isLoading, error } = useUnifiedFiles();
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const deleteFileMutation = useDeleteFile();

  // TODO: 運用時に復活
  // const [editingFile, setEditingFile] = useState<string | null>(null);
  // const reconvertMutation = useReconvertFile();

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

  // const handleReconvert = (originalKey: string, baseName: string) => {
  //   if (
  //     !confirm(
  //       `${baseName} のMarkdownを元ファイルから再生成しますか？\n（現在の編集内容は上書きされます）`,
  //     )
  //   ) {
  //     return;
  //   }
  //   setMessage(null);
  //   reconvertMutation.mutate(
  //     { originalKey, filename: baseName },
  //     {
  //       onSuccess: (result) => {
  //         setMessage({
  //           type: "success",
  //           text: `${result.key} を生成しました（${result.chunks}チャンク）`,
  //         });
  //       },
  //       onError: (err) => {
  //         setMessage({
  //           type: "error",
  //           text: `変換失敗: ${err instanceof Error ? err.message : "Unknown error"}`,
  //         });
  //       },
  //     },
  //   );
  // };

  return (
    <div className="space-y-6">
      {/* TODO: 運用時に復活 - アップロードセクション */}
      {/* <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-bold text-stone-800 mb-4">
          ファイルアップロード
        </h2>
        <FileUpload onSuccess={() => {}} />
      </div> */}

      {/* ファイル一覧セクション */}
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
            onDelete={handleDeleteFile}
            isDeleting={deleteFileMutation.isPending}
            // TODO: 運用時に復活
            // onEdit={(key) => setEditingFile(key)}
            // onReconvert={handleReconvert}
            // isReconverting={reconvertMutation.isPending}
          />
        )}
      </div>

      {/* 閲覧モーダル */}
      {viewingFile && (
        <FileViewer
          fileKey={viewingFile}
          onClose={() => setViewingFile(null)}
        />
      )}

      {/* TODO: 運用時に復活 - エディタモーダル */}
      {/* {editingFile && (
        <FileEditor
          fileKey={editingFile}
          onClose={() => setEditingFile(null)}
        />
      )} */}
    </div>
  );
};
