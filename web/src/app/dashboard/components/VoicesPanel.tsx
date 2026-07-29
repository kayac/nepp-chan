import { XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { Button } from "@nepp-chan/shared/ui/Button";
import { useMemo, useState } from "react";

import { FilterPopover } from "~/app/dashboard/components/voices/FilterPopover";
import {
  activeChips,
  analyzeContextLabel,
  DEFAULT_FILTER,
  getSentimentStyle,
  groupVoicesByTopic,
  mergeVoices,
  removeChip,
  sentimentLabel,
  shouldIncludeEmergencies,
  shouldIncludePersonas,
  toPersonaParams,
  type Voice,
  type VoiceFilter,
  type VoiceSort,
} from "~/app/dashboard/components/voices/helpers";
import { useEmergencies } from "~/app/dashboard/hooks/useEmergencies";
import { useInfiniteScroll } from "~/app/dashboard/hooks/useInfiniteScroll";
import {
  useDeletePersonas,
  useExtractPersonas,
  usePersonas,
} from "~/app/dashboard/hooks/usePersonas";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";
import { PanelLoading } from "~/components/ui/PanelLoading";
import { confirmDialog } from "~/lib/dialog";
import { formatDateTime } from "~/lib/format";

interface Props {
  initialFilter?: Partial<VoiceFilter>;
  canManage?: boolean;
  onAskMayor?: (context: string) => void;
}

const SENTIMENT_BAR_COLORS: Record<string, string> = {
  positive: "#5cb7bb",
  negative: "#e76f7a",
  request: "#f4b860",
  neutral: "#c9d6df",
};

const VoiceCard = ({ voice }: { voice: Voice }) => (
  <article
    data-testid="voice-card"
    className={cn(
      "rounded-xl border border-(--border-1) p-4",
      voice.kind === "emergency" ? "bg-(--danger-bg)" : "bg-(--bg-raised)",
    )}
  >
    <div className="flex flex-wrap items-center gap-2 mb-1.5">
      {voice.kind === "emergency" ? (
        <span className="inline-flex px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded">
          緊急
        </span>
      ) : (
        <>
          {voice.topic && (
            <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-teal-50 text-teal-700 rounded">
              {voice.topic}
            </span>
          )}
          {voice.sentiment && (
            <span
              className={cn(
                "inline-flex px-2 py-0.5 text-xs font-medium rounded",
                getSentimentStyle(voice.sentiment),
              )}
            >
              {sentimentLabel(voice.sentiment)}
            </span>
          )}
        </>
      )}
      <span className="text-xs text-(--fg-4) ml-auto whitespace-nowrap">
        {formatDateTime(voice.date)}
      </span>
    </div>
    <p className="text-sm text-(--fg-1) whitespace-pre-wrap break-words">
      {voice.content}
    </p>
    {voice.kind === "persona" && voice.attributes.length > 0 && (
      <div className="flex flex-wrap gap-1.5 text-xs pt-2">
        {voice.attributes.map((attr) => (
          <span
            key={attr}
            className="inline-flex px-1.5 py-0.5 bg-(--bg-sunken) text-(--fg-3) rounded"
          >
            {attr}
          </span>
        ))}
      </div>
    )}
    {voice.kind === "emergency" && voice.location && (
      <div className="text-xs text-(--fg-3) pt-2">場所: {voice.location}</div>
    )}
  </article>
);

const TopicGroups = ({ voices }: { voices: Voice[] }) => (
  <div className="space-y-3">
    {groupVoicesByTopic(voices).map((group) => {
      const barTotal = Object.values(group.sentiments).reduce(
        (sum, n) => sum + n,
        0,
      );
      return (
        <article
          key={group.topic}
          data-testid="topic-group"
          className="bg-(--bg-raised) rounded-xl border border-(--border-1) p-4"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <h4 className="text-sm font-semibold text-(--fg-1)">
              {group.topic}
            </h4>
            <span className="text-xs text-(--fg-3)">{group.count}件</span>
          </div>
          {barTotal > 0 && (
            <div
              className="flex h-1.5 rounded-full overflow-hidden mb-2"
              aria-hidden="true"
            >
              {Object.entries(group.sentiments)
                .filter(([, n]) => n > 0)
                .map(([key, n]) => (
                  <div
                    key={key}
                    style={{
                      width: `${(n / barTotal) * 100}%`,
                      backgroundColor: SENTIMENT_BAR_COLORS[key],
                    }}
                  />
                ))}
            </div>
          )}
          <p className="text-sm text-(--fg-2)">
            「{group.sample}」
            <span className="text-xs text-(--fg-4) ml-1">— 代表的な声</span>
          </p>
        </article>
      );
    })}
  </div>
);

export const VoicesPanel = ({
  initialFilter,
  canManage = false,
  onAskMayor,
}: Props) => {
  const [filter, setFilter] = useState<VoiceFilter>({
    ...DEFAULT_FILTER,
    ...initialFilter,
  });

  const includePersonas = shouldIncludePersonas(filter);
  const includeEmergencies = shouldIncludeEmergencies(filter);

  const personaParams = useMemo(() => toPersonaParams(filter), [filter]);
  const personasQuery = usePersonas(30, personaParams, {
    enabled: includePersonas,
  });
  const emergenciesQuery = useEmergencies();
  const extractMutation = useExtractPersonas();
  const deleteMutation = useDeletePersonas();

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: personasQuery.hasNextPage ?? false,
    isFetching: personasQuery.isFetchingNextPage,
    onFetch: personasQuery.fetchNextPage,
  });

  const isLoading =
    (includePersonas && personasQuery.isLoading) ||
    (includeEmergencies && emergenciesQuery.isLoading);

  if (isLoading) {
    return <PanelLoading />;
  }

  const error = personasQuery.error ?? emergenciesQuery.error;
  if (error) {
    return <ErrorBanner>{formatError(error)}</ErrorBanner>;
  }

  const personas = includePersonas
    ? (personasQuery.data?.pages.flatMap((page) => page.personas) ?? [])
    : [];
  const emergencies = includeEmergencies
    ? (emergenciesQuery.data?.emergencies ?? [])
    : [];

  const voices = mergeVoices(personas, emergencies, { period: filter.period });
  const emergencyCount = voices.filter((v) => v.kind === "emergency").length;
  const personaTotal = includePersonas
    ? (personasQuery.data?.pages[0]?.total ?? 0)
    : 0;
  const matchCount = personaTotal + emergencyCount;

  const chips = activeChips(filter);

  const handleDelete = () => {
    if (
      !confirmDialog("全てのペルソナを削除しますか？この操作は取り消せません。")
    ) {
      return;
    }
    deleteMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-(--fg-3)">
        全体の傾向は「村の分析」に。ここでは実際の声を一件ずつ読めます。
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <FilterPopover
          filter={filter}
          matchCount={matchCount}
          onChange={setFilter}
        />
        <span className="text-sm text-(--fg-2)">{matchCount}件が該当</span>

        <div className="ml-auto flex items-center gap-1 bg-(--bg-sunken) rounded-(--r-pill) p-1">
          {(
            [
              { value: "list", label: "新しい順" },
              { value: "topics", label: "話題ごと" },
            ] as { value: VoiceSort; label: string }[]
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setFilter({ ...filter, sort: o.value })}
              className={cn(
                "px-3 py-1 rounded-(--r-pill) text-sm transition-colors",
                filter.sort === o.value
                  ? "bg-(--bg-raised) font-medium text-(--fg-1) shadow-(--shadow-xs)"
                  : "text-(--fg-3)",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {(chips.length > 0 || (onAskMayor && matchCount > 0)) && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-label={`${chip.label} を解除`}
              onClick={() => setFilter(removeChip(filter, chip.key))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-(--r-pill) bg-(--brand-soft) text-(--fg-1) text-xs font-medium hover:bg-(--brand-soft-2)"
            >
              {chip.label}
              <XMarkIcon className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          ))}
          {onAskMayor && matchCount > 0 && (
            <button
              type="button"
              onClick={() =>
                onAskMayor(analyzeContextLabel(filter, matchCount))
              }
              className="ml-auto px-3 py-1.5 rounded-(--r-pill) bg-(--brand-soft) text-sm font-medium text-(--fg-1) hover:bg-(--brand-soft-2) transition-colors"
            >
              💬 この{matchCount}件の声を分析してもらう
            </button>
          )}
        </div>
      )}

      {(extractMutation.isError || deleteMutation.isError) && (
        <ErrorBanner>
          {extractMutation.error?.message ||
            deleteMutation.error?.message ||
            "エラーが発生しました"}
        </ErrorBanner>
      )}

      {voices.length === 0 ? (
        <div className="bg-(--bg-raised) rounded-xl border border-(--border-1) py-12 text-center text-sm text-(--fg-3)">
          この条件に当てはまる声はまだありません。条件をゆるめてみてください。
        </div>
      ) : filter.sort === "topics" ? (
        <TopicGroups voices={voices} />
      ) : (
        <div className="space-y-3">
          {voices.map((voice) => (
            <VoiceCard key={`${voice.kind}-${voice.id}`} voice={voice} />
          ))}
          <div ref={loadMoreRef} className="py-2 text-center">
            {personasQuery.isFetchingNextPage && (
              <div className="text-(--fg-3) text-sm">読み込み中...</div>
            )}
          </div>
        </div>
      )}

      {canManage && (
        <div className="flex gap-2 pt-4 border-t border-(--border-1)">
          <Button
            type="button"
            variant="outline"
            onClick={() => extractMutation.mutate()}
            disabled={extractMutation.isPending || deleteMutation.isPending}
          >
            {extractMutation.isPending ? "抽出中..." : "会話から抽出"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={
              extractMutation.isPending ||
              deleteMutation.isPending ||
              personas.length === 0
            }
          >
            {deleteMutation.isPending ? "削除中..." : "全て削除"}
          </Button>
        </div>
      )}
    </div>
  );
};
