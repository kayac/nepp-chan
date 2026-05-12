import { useQuery } from "@tanstack/react-query";

import { emergencyRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

export const useEmergencies = (limit = 100) =>
  useQuery({
    queryKey: dashboardKeys.emergencies,
    queryFn: () => emergencyRepository.fetchEmergencies(limit),
  });
