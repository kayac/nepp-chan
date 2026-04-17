import { useQuery } from "@tanstack/react-query";
import { RootLayout } from "~/components/RootLayout";
import { QueryProvider } from "~/providers/QueryProvider";
import { fetchPollResults } from "~/repository/poll-repository";
import type { PollChoiceResult } from "~/types";

const usePollResultsPublic = (id: string | null) =>
  useQuery({
    queryKey: ["poll-results", id],
    queryFn: () => fetchPollResults(id as string),
    enabled: !!id,
  });

const ChoiceBar = ({
  choice,
  count,
  percentage,
  isLeading,
}: PollChoiceResult & { isLeading: boolean }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm font-medium text-stone-700 truncate">
        {choice}
      </span>
      <span className="text-sm tabular-nums shrink-0 text-stone-500">
        {count}票
      </span>
    </div>
    <div className="h-9 bg-stone-100 rounded-lg overflow-hidden relative">
      <div
        className={`h-full rounded-lg ${isLeading ? "bg-teal-500" : "bg-teal-300"}`}
        style={{ width: `${Math.max(percentage, 2)}%` }}
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-stone-600 tabular-nums">
        {percentage}%
      </span>
    </div>
  </div>
);

const PollContent = ({ id }: { id: string }) => {
  const { data, isLoading, isError } = usePollResultsPublic(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-stone-50">
        <div className="animate-pulse text-center space-y-2">
          <div className="h-4 w-32 bg-stone-200 rounded mx-auto" />
          <div className="h-3 w-24 bg-stone-100 rounded mx-auto" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-stone-50">
        <div className="text-center space-y-2 p-6">
          <p className="text-stone-600 font-medium">投票結果を表示できません</p>
          <p className="text-sm text-stone-400">
            投票が存在しないか、まだ配信されていません
          </p>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...data.choiceResults.map((cr) => cr.count), 0);

  return (
    <div className="min-h-dvh bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <header className="space-y-1">
          <h1 className="text-lg font-bold text-stone-800">{data.title}</h1>
          <p className="text-sm text-stone-500 tabular-nums">
            {data.totalSubmissions}人が参加
          </p>
        </header>

        {data.choiceResults.length === 0 && (
          <div className="bg-white rounded-2xl border border-stone-200/80 p-8 text-center">
            <p className="text-sm text-stone-400">まだ投票がありません</p>
          </div>
        )}

        {data.choiceResults.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 p-5 space-y-3">
            {data.choiceResults.map((cr) => (
              <ChoiceBar
                key={cr.choice}
                {...cr}
                isLeading={cr.count === maxCount && maxCount > 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const PollResultsInner = () => {
  const id = new URLSearchParams(window.location.search).get("id");

  if (!id) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-stone-50">
        <p className="text-stone-500 text-sm">投票IDが指定されていません</p>
      </div>
    );
  }

  return <PollContent id={id} />;
};

export const PollResultsPage = () => (
  <RootLayout>
    <QueryProvider>
      <PollResultsInner />
    </QueryProvider>
  </RootLayout>
);
