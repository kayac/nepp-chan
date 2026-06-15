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

export const useOntology = (params: { from?: string; to?: string } = {}) =>
  useQuery({
    queryKey: dashboardKeys.analyticsOntology(params.from, params.to),
    queryFn: () => analyticsRepository.fetchOntology(params),
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
