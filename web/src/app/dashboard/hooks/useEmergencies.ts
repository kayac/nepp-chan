import { useQuery } from "@tanstack/react-query";

import { emergencyRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

const FETCH_LIMIT = 100;

export const useEmergencies = (options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: dashboardKeys.emergencies,
    queryFn: () => emergencyRepository.fetchEmergencies(FETCH_LIMIT),
    enabled: options.enabled ?? true,
  });
