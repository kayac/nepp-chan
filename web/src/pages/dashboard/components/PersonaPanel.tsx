import {
  useDeletePersonas,
  useExtractPersonas,
  usePersonas,
} from "~/hooks/useDashboard";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import { formatDateTime } from "~/lib/format";

export const PersonaPanel = () => {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePersonas();
  const extractMutation = useExtractPersonas();
  const deleteMutation = useDeletePersonas();
  const loadMoreRef = useInfiniteScroll({
    hasNextPage: hasNextPage ?? false,
    isFetching: isFetchingNextPage,
    onFetch: fetchNextPage,
  });

  const handleExtract = () => {
    extractMutation.mutate();
  };

  const handleDelete = () => {
    if (
      !window.confirm(
        "全てのペルソナを削除しますか？この操作は取り消せません。",
      )
    ) {
      return;
    }
    deleteMutation.mutate();
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

  const personas = data?.pages.flatMap((page) => page.personas) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-stone-500">
          {personas.length} / {total}件のペルソナ
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

      {(extractMutation.isError || deleteMutation.isError) && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700">
          {extractMutation.error?.message ||
            deleteMutation.error?.message ||
            "エラーが発生しました"}
        </div>
      )}

      {personas.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-stone-500">
          ペルソナデータがありません
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-auto max-h-[70vh]">
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
                  会話日時
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
                    {persona.conversationEndedAt
                      ? formatDateTime(persona.conversationEndedAt)
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                    {formatDateTime(persona.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div ref={loadMoreRef} className="py-4 text-center">
            {isFetchingNextPage && (
              <div className="text-stone-500 text-sm">読み込み中...</div>
            )}
            {!hasNextPage && personas.length > 0 && (
              <div className="text-stone-400 text-sm">
                すべてのペルソナを表示しました
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
