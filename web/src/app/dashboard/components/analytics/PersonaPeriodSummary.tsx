import {
  type SentimentCounts,
  sentimentTotal,
  sumSentiments,
  topEntries,
} from "~/lib/analytics-summary";
import { SENTIMENT_SERIES } from "~/lib/chart-helpers";

interface Props {
  data: {
    totalCount: number;
    ageSentiment: ({ age: string } & SentimentCounts)[];
    topics: ({ topic: string; total: number } & SentimentCounts)[];
  };
}

const TOP_N = 3;

const TopList = ({
  title,
  entries,
}: {
  title: string;
  entries: { label: string; count: number }[];
}) => (
  <div>
    <h5 className="text-xs font-medium text-stone-500 mb-1">{title}</h5>
    <ol className="space-y-0.5">
      {entries.map((e) => (
        <li key={e.label} className="flex justify-between text-sm">
          <span className="text-stone-700">{e.label}</span>
          <span className="text-stone-500 tabular-nums">{e.count}件</span>
        </li>
      ))}
    </ol>
  </div>
);

export const PersonaPeriodSummary = ({ data }: Props) => {
  if (data.totalCount === 0) {
    return (
      <p className="text-sm text-stone-500">
        この期間の会話に由来するペルソナはまだありません。
      </p>
    );
  }

  // topic なしの行も「その他」に含まれるため、topics の合計が全件をカバーする
  const sentiments = sumSentiments(data.topics);
  const total = sentimentTotal(sentiments);
  const ages = topEntries(
    data.ageSentiment.map((row) => ({
      label: row.age,
      count: sentimentTotal(row),
    })),
    TOP_N,
  );
  const topics = topEntries(
    data.topics.map((row) => ({ label: row.topic, count: row.total })),
    TOP_N,
  );

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <h5 className="text-xs font-medium text-stone-500 mb-1">ネガポジ</h5>
          <div className="flex h-3 rounded-full overflow-hidden bg-stone-100">
            {SENTIMENT_SERIES.map((s) =>
              sentiments[s.key] > 0 ? (
                <div
                  key={s.key}
                  style={{
                    width: `${(sentiments[s.key] / total) * 100}%`,
                    backgroundColor: s.color,
                  }}
                />
              ) : null,
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            {SENTIMENT_SERIES.map((s) => (
              <span
                key={s.key}
                className="flex items-center gap-1 text-xs text-stone-600"
              >
                <span
                  className="w-2 h-2 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                {s.label} {sentiments[s.key]}
              </span>
            ))}
          </div>
        </div>
        <TopList title="年代（上位）" entries={ages} />
        <TopList title="トピック（上位）" entries={topics} />
      </div>
    </div>
  );
};
