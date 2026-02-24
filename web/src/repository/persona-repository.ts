import { apiClient } from "~/lib/api/client";
import type { PersonasResponse } from "~/types";

type FetchPersonasParams = {
  limit?: number;
  cursor?: string;
};

export const fetchPersonas = (
  params: FetchPersonasParams = {},
): Promise<PersonasResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit ?? 30));
  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  }
  return apiClient<PersonasResponse>(`/admin/persona?${searchParams}`);
};

type ExtractResult =
  | { skipped: true; reason: string }
  | { extracted: true; messageCount: number };

export type ExtractPersonasResponse = {
  message: string;
  results: Array<{
    threadId: string;
    result: ExtractResult;
  }>;
};

export const extractPersonas = (): Promise<ExtractPersonasResponse> =>
  apiClient<ExtractPersonasResponse>("/admin/persona/extract", {
    method: "POST",
  });

export type DeletePersonasResponse = {
  message: string;
  count: number;
};

export const deleteAllPersonas = (): Promise<DeletePersonasResponse> =>
  apiClient<DeletePersonasResponse>("/admin/persona", {
    method: "DELETE",
  });
