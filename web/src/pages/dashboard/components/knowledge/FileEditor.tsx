import { useEffect, useState } from "react";
import { useKnowledgeFile, useSaveFile } from "~/hooks/useDashboard";

type Props = {
  fileKey: string;
  onClose: () => void;
};

export const FileEditor = ({ fileKey, onClose }: Props) => {
  const { data, isLoading, error } = useKnowledgeFile(fileKey);
  const saveMutation = useSaveFile();
  const [content, setContent] = useState("");
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    if (data?.content) {
      setContent(data.content);
    }
  }, [data?.content]);

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ key: fileKey, content });
      onClose();
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-full max-w-4xl mx-4">
          <div className="text-center py-8 text-stone-500">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-full max-w-4xl mx-4">
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
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h3 className="text-lg font-bold text-stone-800">{fileKey}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPreview(!isPreview)}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                isPreview
                  ? "bg-teal-100 text-teal-700"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              {isPreview ? "プレビュー" : "編集"}
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-auto p-4">
          {isPreview ? (
            <div className="prose prose-stone max-w-none whitespace-pre-wrap">
              {content}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-full min-h-[400px] p-3 border border-stone-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              placeholder="Markdown を入力..."
            />
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between p-4 border-t border-stone-200 bg-stone-50">
          {saveMutation.isError && (
            <span className="text-sm text-red-600">
              保存に失敗しました:{" "}
              {saveMutation.error instanceof Error
                ? saveMutation.error.message
                : "不明なエラー"}
            </span>
          )}
          {saveMutation.isSuccess && (
            <span className="text-sm text-green-600">保存しました</span>
          )}
          {!saveMutation.isError && !saveMutation.isSuccess && <span />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-600 hover:text-stone-800"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-4 py-2 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
