import { apiClient } from "~/lib/api/client";
import type { EmergenciesResponse } from "~/types";

export const fetchEmergencies = (limit = 100): Promise<EmergenciesResponse> => {
  const params = new URLSearchParams({ limit: String(limit) });
  return apiClient<EmergenciesResponse>(`/admin/emergency?${params}`, {
    admin: true,
  });
};
