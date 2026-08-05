import {
  dailyBars,
  sentimentTotal,
  sumSentiments,
  topEntries,
} from "~/lib/analytics-summary";
import { toDateString } from "~/lib/date";
import { periodRange, rollingFrom } from "~/lib/voice-period";
import { useConversationAnalytics, usePersonaAnalytics } from "./useAnalytics";
import { useBroadcasts } from "./useBroadcasts";
import { usePersonaTopics } from "./usePersonas";
import { usePolls } from "./usePolls";

const PERIOD = "d7" as const;
const PERIOD_DAYS = 7;
const LIST_LIMIT = 5;
const TOP_LIMIT = 4;
const SPEAKER_LIMIT = 2;
const TOPIC_SENTS = ["positive", "neutral"] as const;
const TROUBLE_SENTS = ["negative", "request"] as const;

type TopicAggregation = {
  topics: {
    topic: string;
    total: number;
    sample: string | null;
    topTags: { tag: string; count: number }[];
  }[];
};

const toRows = (data: TopicAggregation | undefined) =>
  [...(data?.topics ?? [])]
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_LIMIT)
    .map((t) => ({
      topic: t.topic,
      count: t.total,
      chips: t.topTags,
      sample: t.sample,
    }));

// 「不明」は上位を占めても村の解釈につながらないため話し手の内訳から外す
const topKnown = (entries: { label: string; count: number }[]) =>
  topEntries(
    entries.filter((e) => e.label !== "不明"),
    SPEAKER_LIMIT,
  );

export const useHomeSummary = () => {
  const now = new Date();
  const period = periodRange(PERIOD, now);

  const positiveTopics = usePersonaTopics({
    ...period,
    sentiments: [...TOPIC_SENTS],
  });
  const troubleTopics = usePersonaTopics({
    ...period,
    sentiments: [...TROUBLE_SENTS],
  });
  const conversations = useConversationAnalytics(PERIOD_DAYS);
  const personaStats = usePersonaAnalytics(period);
  const broadcasts = useBroadcasts(LIST_LIMIT, { status: "scheduled" });
  const polls = usePolls(LIST_LIMIT, { status: "sent" });

  return {
    periodLabel: {
      from: rollingFrom(now, PERIOD_DAYS),
      to: toDateString(now),
    },
    positives: toRows(positiveTopics.data),
    troubles: toRows(troubleTopics.data),
    conversationCount: conversations.data?.totals.conversations ?? 0,
    voiceCount: personaStats.data?.totalCount ?? 0,
    bars: dailyBars(conversations.data?.daily ?? []),
    // 管理画面からの動作確認は村の声ではないため流入元に出さない
    platforms: (conversations.data?.platforms ?? []).filter(
      (p) => p.platform !== "admin",
    ),
    sentiments: sumSentiments(personaStats.data?.topics ?? []),
    ages: topKnown(
      (personaStats.data?.ageSentiment ?? []).map((row) => ({
        label: row.age,
        count: sentimentTotal(row),
      })),
    ),
    residences: topKnown(personaStats.data?.segments.residence ?? []),
    relationships: topKnown(personaStats.data?.segments.relationship ?? []),
    scheduledBroadcasts:
      broadcasts.data?.pages.flatMap((p) => p.broadcasts) ?? [],
    activePolls: polls.data?.pages.flatMap((p) => p.polls) ?? [],
    isLoading:
      positiveTopics.isLoading ||
      troubleTopics.isLoading ||
      conversations.isLoading ||
      personaStats.isLoading,
    error:
      positiveTopics.error ??
      troubleTopics.error ??
      conversations.error ??
      personaStats.error,
  };
};
