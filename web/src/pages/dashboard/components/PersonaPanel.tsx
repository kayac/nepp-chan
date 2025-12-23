import { useState } from "react";
import {
  useDeletePersonas,
  useExtractPersonas,
  usePersonas,
} from "~/hooks/useDashboard";

export const PersonaPanel = () => {
  const { data, isLoading, error } = usePersonas();
  const extractMutation = useExtractPersonas();
  const deleteMutation = useDeletePersonas();
  const [message, setMessage] = useState<string | null>(null);

  const handleExtract = async () => {
    setMessage(null);
    try {
      const result = await extractMutation.mutateAsync();
      setMessage(result.message);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "ペルソナ抽出に失敗しました",
      );
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "全てのペルソナを削除しますか？この操作は取り消せません。",
      )
    ) {
      return;
    }
    setMessage(null);
    try {
      const result = await deleteMutation.mutateAsync();
      setMessage(result.message);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "ペルソナ削除に失敗しました",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-stone-500">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
        エラー: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  const personas = data?.personas ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-stone-500">
          {personas.length}件のペルソナ
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExtract}
            disabled={extractMutation.isPending || deleteMutation.isPending}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {extractMutation.isPending ? "抽出中..." : "会話から抽出"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={
              extractMutation.isPending ||
              deleteMutation.isPending ||
              personas.length === 0
            }
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {deleteMutation.isPending ? "削除中..." : "全て削除"}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            extractMutation.isError || deleteMutation.isError
              ? "bg-red-50 text-red-700"
              : "bg-teal-50 text-teal-700"
          }`}
        >
          {message}
        </div>
      )}

      {personas.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-stone-500">
          ペルソナデータがありません
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-stone-600 whitespace-nowrap w-32">
                    カテゴリ
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600 whitespace-nowrap">
                    トピック
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600 whitespace-nowrap">
                    内容
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600 whitespace-nowrap">
                    感情
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600 whitespace-nowrap">
                    属性
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600 whitespace-nowrap w-24">
                    タグ
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600 whitespace-nowrap">
                    作成日時
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {personas.map((persona) => (
                  <tr key={persona.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 w-32">
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-teal-50 text-teal-700 rounded">
                        {persona.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {persona.topic || "-"}
                    </td>
                    <td className="px-4 py-3 text-stone-700 max-w-md whitespace-pre-wrap wrap-break-word">
                      {persona.content}
                    </td>
                    <td className="px-4 py-3">
                      {persona.sentiment && (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                            persona.sentiment === "positive"
                              ? "bg-green-50 text-green-700"
                              : persona.sentiment === "negative"
                                ? "bg-red-50 text-red-700"
                                : persona.sentiment === "request"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {persona.sentiment}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600 text-xs">
                      {persona.demographicSummary || "-"}
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs w-24">
                      {persona.tags || "-"}
                    </td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                      {new Date(persona.createdAt).toLocaleString("ja-JP")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
