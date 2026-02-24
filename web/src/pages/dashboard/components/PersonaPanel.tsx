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

  const getSentimentStyle = (sentiment: string | null) => {
    if (!sentiment) return "";
    switch (sentiment) {
      case "positive":
        return "bg-green-50 text-green-700";
      case "negative":
        return "bg-red-50 text-red-700";
      case "request":
        return "bg-amber-50 text-amber-700";
      default:
        return "bg-stone-100 text-stone-600";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-sm text-stone-500">
          {personas.length} / {total}件のペルソナ
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExtract}
            disabled={extractMutation.isPending || deleteMutation.isPending}
            className="flex-1 sm:flex-none px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <div className="bg-white rounded-xl border border-stone-200 overflow-auto max-h-[70dvh]">
          <div
            className="grid text-sm"
            style={{
              gridTemplateColumns:
                "minmax(5rem, auto) minmax(5rem, auto) 1fr minmax(4rem, auto) minmax(8rem, auto)",
            }}
          >
            <div className="contents hidden md:[display:contents] font-medium text-stone-600 bg-stone-50 text-xs">
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                カテゴリ
              </div>
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                トピック
              </div>
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                内容
              </div>
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                感情
              </div>
              <div className="px-4 py-3 border-b border-stone-200 sticky top-0 bg-stone-50">
                会話日時
              </div>
            </div>

            {personas.map((persona) => (
              <div
                key={persona.id}
                className="contents md:[&>div]:border-b md:[&>div]:border-stone-100 md:hover:[&>div]:bg-stone-50"
              >
                <div className="col-span-full md:col-span-1 px-4 pt-3 md:py-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex px-2 py-1 text-xs font-medium bg-teal-50 text-teal-700 rounded">
                    {persona.category}
                  </span>
                  {persona.sentiment && (
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded md:hidden ${getSentimentStyle(persona.sentiment)}`}
                    >
                      {persona.sentiment}
                    </span>
                  )}
                  <span className="text-xs text-stone-400 whitespace-nowrap md:hidden ml-auto">
                    {persona.conversationEndedAt
                      ? formatDateTime(persona.conversationEndedAt)
                      : "-"}
                  </span>
                </div>
                <div className="hidden md:block px-4 py-3 text-stone-600 text-xs">
                  {persona.topic || "-"}
                </div>
                <div className="col-span-full md:col-span-1 px-4 py-1 md:py-3">
                  {persona.topic && (
                    <div className="text-xs text-stone-500 mb-1 md:hidden">
                      <span className="font-medium">トピック:</span>{" "}
                      {persona.topic}
                    </div>
                  )}
                  <p className="text-stone-700 whitespace-pre-wrap break-words">
                    {persona.content}
                  </p>
                  {(persona.demographicSummary || persona.tags) && (
                    <div className="flex flex-wrap gap-2 text-xs text-stone-500 pt-1 md:hidden">
                      {persona.demographicSummary && (
                        <span>属性: {persona.demographicSummary}</span>
                      )}
                      {persona.tags && <span>タグ: {persona.tags}</span>}
                    </div>
                  )}
                </div>
                <div className="hidden md:block px-4 py-3">
                  {persona.sentiment && (
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getSentimentStyle(persona.sentiment)}`}
                    >
                      {persona.sentiment}
                    </span>
                  )}
                </div>
                <div className="hidden md:block px-4 py-3 text-stone-500 text-xs whitespace-nowrap">
                  {persona.conversationEndedAt
                    ? formatDateTime(persona.conversationEndedAt)
                    : "-"}
                </div>
                <div className="col-span-full h-px bg-stone-100 md:hidden" />
              </div>
            ))}
          </div>
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
