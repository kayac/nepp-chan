import { useMemo, useState } from "react";

import {
  DEFAULT_FILTER,
  shouldIncludeEmergencies,
  shouldIncludePersonas,
  toPersonaFilters,
  type VoiceFilter,
} from "~/app/dashboard/components/voices/helpers";
import { toDateString } from "~/lib/date";
import { type EmergencyItem, mergeVoices, personaDate } from "~/lib/voice";
import { periodRange } from "~/lib/voice-period";
import { useEmergencies } from "./useEmergencies";
import { useInfiniteScroll } from "./useInfiniteScroll";
import { usePersonas, usePersonaTopics } from "./usePersonas";

export const EMERGENCY_TOPIC = "緊急";

const onOrAfter = (iso: string, from: string | undefined) =>
  !from || toDateString(new Date(iso)) >= from;

export const useVoices = (initialFilter?: Partial<VoiceFilter>) => {
  const [filter, setFilter] = useState<VoiceFilter>({
    ...DEFAULT_FILTER,
    ...initialFilter,
  });

  const includePersonas = shouldIncludePersonas(filter);
  const includeEmergencies = shouldIncludeEmergencies(filter);
  const personaFilters = useMemo(() => toPersonaFilters(filter), [filter]);

  const listQuery = usePersonas(personaFilters, { enabled: includePersonas });
  const topicsQuery = usePersonaTopics(personaFilters, {
    enabled: includePersonas && filter.sort === "topics",
  });
  const emergenciesQuery = useEmergencies({ enabled: includeEmergencies });

  const periodFrom = periodRange(filter.period).from;
  const personas = includePersonas
    ? (listQuery.data?.pages.flatMap((p) => p.personas) ?? [])
    : [];

  const periodEmergencies: EmergencyItem[] = includeEmergencies
    ? (emergenciesQuery.data?.emergencies ?? []).filter((e) =>
        onOrAfter(e.reportedAt, periodFrom),
      )
    : [];

  const voices = useMemo(() => {
    const oldest =
      listQuery.hasNextPage && personas.length > 0
        ? toDateString(new Date(personaDate(personas[personas.length - 1])))
        : periodFrom;
    return mergeVoices(
      personas,
      periodEmergencies.filter((e) => onOrAfter(e.reportedAt, oldest)),
    );
  }, [personas, periodEmergencies, periodFrom, listQuery.hasNextPage]);

  const topics = useMemo(() => {
    const fromServer = topicsQuery.data?.topics ?? [];
    if (periodEmergencies.length === 0) {
      return fromServer;
    }
    const newest = [...periodEmergencies].sort((a, b) =>
      b.reportedAt.localeCompare(a.reportedAt),
    )[0];
    return [
      ...fromServer,
      {
        topic: EMERGENCY_TOPIC,
        total: periodEmergencies.length,
        sentiments: { positive: 0, negative: 0, request: 0, neutral: 0 },
        sample: newest.description
          ? `${newest.type}：${newest.description}`
          : newest.type,
      },
    ].sort((a, b) => b.total - a.total);
  }, [topicsQuery.data, periodEmergencies]);

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: listQuery.hasNextPage ?? false,
    isFetching: listQuery.isFetchingNextPage,
    onFetch: listQuery.fetchNextPage,
  });

  return {
    filter,
    setFilter,
    voices,
    topics,
    matchCount:
      (includePersonas ? (listQuery.data?.pages[0]?.total ?? 0) : 0) +
      periodEmergencies.length,
    isLoading:
      (includePersonas && listQuery.isLoading) ||
      (includeEmergencies && emergenciesQuery.isLoading) ||
      (filter.sort === "topics" && topicsQuery.isLoading),
    error: listQuery.error ?? emergenciesQuery.error ?? topicsQuery.error,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    loadMoreRef,
  };
};
