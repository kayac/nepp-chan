import { useQuery } from "@tanstack/react-query";

import { emergencyRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

// 期間絞り込みは API 未対応のため全件取得してクライアントで切る
const FETCH_LIMIT = 100;

export const useEmergencies = (options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: dashboardKeys.emergencies,
    queryFn: () => emergencyRepository.fetchEmergencies(FETCH_LIMIT),
    enabled: options.enabled ?? true,
  });
