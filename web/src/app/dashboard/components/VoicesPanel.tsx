import { XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { VoiceCard } from "~/app/dashboard/components/VoiceCard";
import { FilterPopover } from "~/app/dashboard/components/voices/FilterPopover";
import {
  activeChips,
  analyzeContextLabel,
  removeChip,
  SORT_OPTIONS,
  type VoiceFilter,
} from "~/app/dashboard/components/voices/helpers";
import { EMERGENCY_TOPIC, useVoices } from "~/app/dashboard/hooks/useVoices";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";
import { PanelLoading } from "~/components/ui/PanelLoading";

interface Props {
  initialFilter?: Partial<VoiceFilter>;
  onAskMayor?: (context: string) => void;
}

const SENTIMENT_BAR_COLORS: Record<string, string> = {
  positive: "#5cb7bb",
  negative: "#e76f7a",
  request: "#f4b860",
  neutral: "#c9d6df",
};

type TopicGroup = {
  topic: string;
  total: number;
  sentiments: Record<"positive" | "negative" | "request" | "neutral", number>;
  sample: string | null;
};

const TopicGroups = ({
  topics,
  onSelect,
}: {
  topics: TopicGroup[];
  onSelect: (topic: string) => void;
}) => (
  <div className="space-y-3">
    {topics.map((group) => {
      const barTotal = Object.values(group.sentiments).reduce(
        (sum, n) => sum + n,
        0,
      );
      return (
        <button
          key={group.topic}
          type="button"
          onClick={() => onSelect(group.topic)}
          data-testid="topic-group"
          className="block w-full text-left bg-(--bg-raised) rounded-xl border border-(--border-1) p-4 hover:bg-(--bg-sunken) transition-colors"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <h4 className="text-sm font-semibold text-(--fg-1)">
              {group.topic}
            </h4>
            <span className="text-xs text-(--fg-3)">{group.total}件</span>
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
          {group.sample && (
            <p className="text-sm text-(--fg-2)">
              「{group.sample}」
              <span className="text-xs text-(--fg-4) ml-1">— 代表的な声</span>
            </p>
          )}
        </button>
      );
    })}
  </div>
);

export const VoicesPanel = ({ initialFilter, onAskMayor }: Props) => {
  const {
    filter,
    setFilter,
    voices,
    topics,
    matchCount,
    isLoading,
    error,
    isFetchingNextPage,
    loadMoreRef,
  } = useVoices(initialFilter);

  if (isLoading) {
    return <PanelLoading />;
  }

  if (error) {
    return <ErrorBanner>{formatError(error)}</ErrorBanner>;
  }

  const chips = activeChips(filter);

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
          {SORT_OPTIONS.map((o) => (
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

      {matchCount === 0 ? (
        <div className="bg-(--bg-raised) rounded-xl border border-(--border-1) py-12 text-center text-sm text-(--fg-3)">
          この条件に当てはまる声はまだありません。条件をゆるめてみてください。
        </div>
      ) : filter.sort === "topics" ? (
        <TopicGroups
          topics={topics}
          onSelect={(topic) =>
            setFilter(
              topic === EMERGENCY_TOPIC
                ? { ...filter, sort: "list", sents: ["emergency"] }
                : { ...filter, sort: "list", topic },
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {voices.map((voice) => (
            <VoiceCard key={`${voice.kind}-${voice.id}`} voice={voice} />
          ))}
          <div ref={loadMoreRef} className="py-2 text-center">
            {isFetchingNextPage && (
              <div className="text-(--fg-3) text-sm">読み込み中...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
