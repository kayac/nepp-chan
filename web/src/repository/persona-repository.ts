import { apiClient } from "~/lib/api/client";
import type { PersonasResponse } from "~/types";

export const fetchPersonas = (limit = 100): Promise<PersonasResponse> => {
  const params = new URLSearchParams({ limit: String(limit) });
  return apiClient<PersonasResponse>(`/admin/persona?${params}`, {
    admin: true,
  });
};
