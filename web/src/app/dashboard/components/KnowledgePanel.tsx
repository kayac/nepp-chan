import { useState } from "react";
import {
  CuratedComposer,
  FileEditor,
  FileList,
  FileUpload,
  FileViewer,
} from "~/app/dashboard/components/knowledge";
import {
  CURATED_PREFIX,
  type KnowledgePrefix,
  OFFICIAL_PREFIX,
} from "~/app/dashboard/components/knowledge/helpers";
import { useInfiniteScroll } from "~/app/dashboard/hooks/useInfiniteScroll";
import {
  useDeleteFile,
  useKnowledgeFiles,
  useSyncKnowledge,
} from "~/app/dashboard/hooks/useKnowledge";

const TABS = [
  { prefix: CURATED_PREFIX, label: "追加したナレッジ" },
  { prefix: OFFICIAL_PREFIX, label: "公式資料" },
] as const;

const SECTION_HEADING = "text-base font-bold text-stone-800 mb-4";

const EMPTY_MESSAGE: Record<KnowledgePrefix, string> = {
  [CURATED_PREFIX]: "まだありません。上の「ナレッジを追加」から作れます",
  [OFFICIAL_PREFIX]: "まだありません。上からファイルを追加できます",
};

type ListProps = {
  prefix: KnowledgePrefix;
  onView: (key: string) => void;
  onEdit: (key: string) => void;
  onDelete: (key: string) => void;
  isDeleting: boolean;
};

const KnowledgeFiles = ({ prefix, ...handlers }: ListProps) => {
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useKnowledgeFiles(prefix);
  const loadMoreRef = useInfiniteScroll({
    hasNextPage: hasNextPage ?? false,
    isFetching: isFetchingNextPage,
    onFetch: fetchNextPage,
  });

  if (isLoading) {
    return <div className="text-center py-8 text-stone-500">読み込み中...</div>;
  }
  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        エラー:{" "}
        {error instanceof Error ? error.message : "読み込みに失敗しました"}
      </div>
    );
  }

  return (
    <FileList
      files={data?.pages.flatMap((page) => page.files) ?? []}
      emptyMessage={EMPTY_MESSAGE[prefix]}
      loadMoreRef={loadMoreRef}
      hasNextPage={hasNextPage ?? false}
      isFetchingNextPage={isFetchingNextPage}
      {...handlers}
    />
  );
};

export const KnowledgePanel = () => {
  const [tab, setTab] = useState<KnowledgePrefix>(CURATED_PREFIX);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const deleteFileMutation = useDeleteFile();
  const syncMutation = useSyncKnowledge();

  const handleSync = () => {
    if (
      !confirm(
        "R2 にある全ファイルを検索データに再同期します。反映まで数分かかります",
      )
    ) {
      return;
    }
    setMessage(null);
    syncMutation.mutate(undefined, {
      onSuccess: (result) => {
        setMessage({ type: "success", text: result.message });
      },
      onError: (err) => {
        setMessage({
          type: "error",
          text: `再同期失敗: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      },
    });
  };

  const handleDeleteFile = (key: string) => {
    if (
      !confirm(`${key} を削除しますか？\nMarkdown と検索データが削除されます`)
    ) {
      return;
    }
    setMessage(null);
    deleteFileMutation.mutate(key, {
      onSuccess: () => {
        setMessage({ type: "success", text: `${key} を削除しました` });
      },
      onError: (err) => {
        setMessage({
          type: "error",
          text: `削除失敗: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      },
    });
  };

  const handlers = {
    onView: setViewingFile,
    onEdit: setEditingFile,
    onDelete: handleDeleteFile,
    isDeleting: deleteFileMutation.isPending,
  };

  return (
    <div className="space-y-6">
      <div>
        <div
          role="tablist"
          aria-label="ナレッジの種類"
          className="flex border-b border-stone-300 divide-x divide-stone-300"
        >
          {TABS.map((item) => (
            <button
              key={item.prefix}
              type="button"
              role="tab"
              aria-selected={tab === item.prefix}
              onClick={() => setTab(item.prefix)}
              className={`px-4 py-2 -mb-px text-sm font-medium border-t border-b border-stone-300 rounded-t-lg first:border-l last:border-r transition-colors ${
                tab === item.prefix
                  ? "border-b-white bg-white text-stone-800"
                  : "border-b-transparent bg-stone-100 text-stone-600 hover:text-stone-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-b-xl border border-t-0 border-stone-300 p-6">
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

          <div hidden={tab !== CURATED_PREFIX} className="space-y-6">
            <section>
              <h3 className={SECTION_HEADING}>ナレッジを追加</h3>
              <CuratedComposer />
            </section>
            <section>
              <h3 className={SECTION_HEADING}>ナレッジ一覧</h3>
              {tab === CURATED_PREFIX && (
                <KnowledgeFiles prefix={CURATED_PREFIX} {...handlers} />
              )}
            </section>
          </div>

          <div hidden={tab !== OFFICIAL_PREFIX} className="space-y-6">
            <section>
              <h3 className={SECTION_HEADING}>公式資料をアップロード</h3>
              <FileUpload />
            </section>
            <section>
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <h3 className="text-base font-bold text-stone-800">
                  公式資料一覧
                </h3>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  className="text-sm text-teal-600 hover:text-teal-800 hover:underline disabled:opacity-50"
                >
                  {syncMutation.isPending
                    ? "再同期中..."
                    : "検索データを再同期"}
                </button>
              </div>
              {tab === OFFICIAL_PREFIX && (
                <KnowledgeFiles prefix={OFFICIAL_PREFIX} {...handlers} />
              )}
            </section>
          </div>
        </div>
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
