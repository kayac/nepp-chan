import {
  PLATFORM_LABELS,
  type SentimentCounts,
  sentimentTotal,
} from "~/lib/analytics-summary";
import { SENTIMENT_SERIES, type SentimentKey } from "~/lib/chart-helpers";
import { type DailyBar, WeekTrendChart } from "./WeekTrendChart";

type Entry = { label: string; count: number };

// 中立は声一覧の絞り込み条件に無いため表示だけにする
const FILTERABLE: SentimentKey[] = ["positive", "negative", "request"];

interface Props {
  conversationCount: number;
  voiceCount: number;
  bars: DailyBar[];
  platforms: { platform: string; count: number }[];
  sentiments: SentimentCounts;
  ages: Entry[];
  residences: Entry[];
  relationships: Entry[];
  onShowConversations: () => void;
  onShowVillage: () => void;
  onShowSentiment: (key: SentimentKey) => void;
}

const Metric = ({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) => {
  const body = (
    <>
      {label}{" "}
      <span className="text-xl font-bold text-(--fg-1)">
        {value.toLocaleString()}
      </span>
      <span className="text-xs text-(--fg-3)">件</span>
    </>
  );
  if (!onClick) {
    return <span className="text-sm text-(--fg-2) px-2 py-1">{body}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-(--fg-2) rounded-(--r-md) px-2 py-1 hover:bg-(--bg-sunken) transition-colors"
    >
      {body}
    </button>
  );
};

const SpeakerRow = ({
  title,
  entries,
}: {
  title: string;
  entries: Entry[];
}) => (
  <div className="flex items-center gap-2">
    <dt className="w-10 shrink-0 text-xs text-(--fg-3)">{title}</dt>
    <dd className="flex flex-wrap gap-1.5">
      {entries.map((e) => (
        <span
          key={e.label}
          className="text-xs rounded-(--r-pill) px-2.5 py-0.5 bg-(--bg-sunken) text-(--fg-2)"
        >
          {e.label} <span className="font-medium text-(--fg-1)">{e.count}</span>
        </span>
      ))}
    </dd>
  </div>
);

export const WeekSummary = ({
  conversationCount,
  voiceCount,
  bars,
  platforms,
  sentiments,
  ages,
  residences,
  relationships,
  onShowConversations,
  onShowVillage,
  onShowSentiment,
}: Props) => {
  const voiceTotal = sentimentTotal(sentiments);
  const speakers = [
    { title: "年代", entries: ages },
    { title: "住まい", entries: residences },
    { title: "立場", entries: relationships },
  ].filter((row) => row.entries.length > 0);

  return (
    <div className="space-y-4">
      <div
        data-testid="activity-strip"
        className="flex flex-wrap items-end gap-x-4 gap-y-1 -mx-2"
      >
        <Metric
          label="会話"
          value={conversationCount}
          onClick={onShowConversations}
        />
        <Metric label="集まった声" value={voiceCount} onClick={onShowVillage} />
        {platforms.length > 0 && (
          <span className="ml-auto mr-2 text-xs text-(--fg-3)">
            {platforms
              .map(
                (p) =>
                  `${PLATFORM_LABELS[p.platform] ?? p.platform} ${p.count}`,
              )
              .join(" · ")}
          </span>
        )}
      </div>

      {bars.length > 0 && (
        <div data-testid="week-trend">
          <h4 className="text-sm font-medium text-(--fg-2) mb-1">
            日別の会話数
          </h4>
          <WeekTrendChart bars={bars} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {voiceTotal > 0 && (
          <div data-testid="sentiment-breakdown">
            <h4 className="text-sm font-medium text-(--fg-2) mb-2">声の内訳</h4>
            <div className="flex h-3 rounded-(--r-pill) overflow-hidden bg-(--bg-sunken)">
              {SENTIMENT_SERIES.map((s) =>
                sentiments[s.key] > 0 ? (
                  <div
                    key={s.key}
                    style={{
                      width: `${(sentiments[s.key] / voiceTotal) * 100}%`,
                      backgroundColor: s.color,
                    }}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {SENTIMENT_SERIES.map((s) => {
                const chip = (
                  <>
                    <span
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.label} {sentiments[s.key]}
                  </>
                );
                return FILTERABLE.includes(s.key) ? (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => onShowSentiment(s.key)}
                    className="flex items-center gap-1 text-xs text-(--fg-2) rounded-(--r-pill) px-1.5 py-0.5 -mx-1.5 hover:bg-(--bg-sunken) transition-colors"
                  >
                    {chip}
                  </button>
                ) : (
                  <span
                    key={s.key}
                    className="flex items-center gap-1 text-xs text-(--fg-3) px-1.5 py-0.5"
                  >
                    {chip}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {speakers.length > 0 && (
          <div data-testid="speaker-breakdown">
            <h4 className="text-sm font-medium text-(--fg-2) mb-2">声の分布</h4>
            <dl className="space-y-1.5">
              {speakers.map((row) => (
                <SpeakerRow key={row.title} {...row} />
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
};
