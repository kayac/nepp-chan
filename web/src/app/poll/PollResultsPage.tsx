import { useQuery } from "@tanstack/react-query";

import { ChoiceBar } from "~/app/poll/components/ChoiceBar";
import { RootLayout } from "~/components/RootLayout";
import { pollRepository } from "~/lib/api/repository";
import { getCurrentSearchParams } from "~/lib/redirect";
import { QueryProvider } from "~/providers/QueryProvider";
import { isLeadingChoice, maxChoiceCount } from "./aggregator";

const usePollResultsPublic = (id: string | null) =>
  useQuery({
    queryKey: ["poll-results", id],
    queryFn: () => pollRepository.fetchPollResults(id as string),
    enabled: !!id,
  });

const PollContent = ({ id }: { id: string }) => {
  const { data, isLoading, isError } = usePollResultsPublic(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-(--panel)">
        <div className="animate-pulse text-center space-y-2">
          <div className="h-4 w-32 bg-stone-200 rounded mx-auto" />
          <div className="h-3 w-24 bg-stone-100 rounded mx-auto" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-(--panel)">
        <div className="text-center space-y-2 p-6">
          <p className="text-stone-600 font-medium">投票結果を表示できません</p>
          <p className="text-sm text-stone-400">
            投票が存在しないか、まだ配信されていません
          </p>
        </div>
      </div>
    );
  }

  const maxCount = maxChoiceCount(data.choiceResults);

  return (
    <div className="min-h-dvh bg-(--panel)">
      <div className="max-w-lg mx-auto">
        {/* 山ヘッダー: 裾が背景 #DFE2E3 と地続きになり溶け込む（LINE パネルと共通） */}
        <img
          src="/line-assets/hero-mountain-generated-20x2-full-nearest.png"
          alt=""
          className="w-full aspect-[20/2] object-cover"
        />
        <div className="px-4 pt-5 pb-6 space-y-5">
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
                  isLeading={isLeadingChoice(cr, maxCount)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const PollResultsInner = () => {
  const id = getCurrentSearchParams().get("id");

  if (!id) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-(--panel)">
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
