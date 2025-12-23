import { apiClient } from "~/lib/api/client";
import type { PersonasResponse } from "~/types";

export const fetchPersonas = (limit = 100): Promise<PersonasResponse> => {
  const params = new URLSearchParams({ limit: String(limit) });
  return apiClient<PersonasResponse>(`/admin/persona?${params}`, {
    admin: true,
  });
};

type ExtractResult =
  | { skipped: true; reason: string }
  | { extracted: true; messageCount: number };

export type ExtractPersonasResponse = {
  success: boolean;
  message: string;
  results: Array<{
    threadId: string;
    result: ExtractResult;
  }>;
};

export const extractPersonas = (): Promise<ExtractPersonasResponse> =>
  apiClient<ExtractPersonasResponse>("/admin/persona/extract", {
    method: "POST",
    admin: true,
  });

export type DeletePersonasResponse = {
  success: boolean;
  message: string;
  count: number;
};

export const deleteAllPersonas = (): Promise<DeletePersonasResponse> =>
  apiClient<DeletePersonasResponse>("/admin/persona", {
    method: "DELETE",
    admin: true,
  });
