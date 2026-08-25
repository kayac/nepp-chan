import { useQuery } from "@tanstack/react-query";

import { analyticsRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

export const usePersonaAnalytics = (
  params: { from?: string; to?: string } = {},
) =>
  useQuery({
    queryKey: dashboardKeys.analyticsPersona(params.from, params.to),
    queryFn: () => analyticsRepository.fetchPersonaAnalytics(params),
  });

export const useOntology = () =>
  useQuery({
    queryKey: dashboardKeys.analyticsOntology,
    queryFn: () => analyticsRepository.fetchOntology(),
  });

export const useConversationAnalytics = (days = 30) =>
  useQuery({
    queryKey: dashboardKeys.analyticsConversations(days),
    queryFn: () => analyticsRepository.fetchConversationAnalytics(days),
  });

export const useUsageAnalytics = (weeks = 12) =>
  useQuery({
    queryKey: dashboardKeys.analyticsUsage(weeks),
    queryFn: () => analyticsRepository.fetchUsageAnalytics(weeks),
  });

export const useThreadUsage = (days = 30, limit = 50) =>
  useQuery({
    queryKey: dashboardKeys.analyticsThreadUsage(days, limit),
    queryFn: () => analyticsRepository.fetchThreadUsage({ days, limit }),
  });

export const useOperationCost = (days = 30) =>
  useQuery({
    queryKey: dashboardKeys.analyticsOperationCost(days),
    queryFn: () => analyticsRepository.fetchOperationCost(days),
  });

export const useThreadTurnUsage = (threadId: string | null) =>
  useQuery({
    queryKey: dashboardKeys.analyticsThreadTurnUsage(threadId ?? ""),
    queryFn: () => {
      if (!threadId) throw new Error("threadId is required");
      return analyticsRepository.fetchThreadTurnUsage(threadId);
    },
    enabled: !!threadId,
  });

export const useWeeklyReports = () =>
  useQuery({
    queryKey: dashboardKeys.weeklyReports,
    queryFn: () => analyticsRepository.fetchWeeklyReports(),
  });

export const useWeeklyReportDetail = (id: string | null) =>
  useQuery({
    queryKey: dashboardKeys.weeklyReportDetail(id ?? ""),
    queryFn: () => {
      if (!id) throw new Error("ID is required");
      return analyticsRepository.fetchWeeklyReportById(id);
    },
    enabled: !!id,
  });
