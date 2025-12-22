import type {
  DeleteResult,
  EmergenciesResponse,
  PersonasResponse,
  SyncResult,
} from "~/types";
import { apiClient } from "./client";

export const syncKnowledge = (): Promise<SyncResult> =>
  apiClient<SyncResult>("/admin/knowledge/sync", {
    method: "POST",
    admin: true,
  });

export const deleteAllKnowledge = (): Promise<DeleteResult> =>
  apiClient<DeleteResult>("/admin/knowledge", {
    method: "DELETE",
    admin: true,
  });

export const fetchPersonas = (limit = 100): Promise<PersonasResponse> => {
  const params = new URLSearchParams({ limit: String(limit) });
  return apiClient<PersonasResponse>(`/admin/persona?${params}`, {
    admin: true,
  });
};

export const fetchEmergencies = (limit = 100): Promise<EmergenciesResponse> => {
  const params = new URLSearchParams({ limit: String(limit) });
  return apiClient<EmergenciesResponse>(`/admin/emergency?${params}`, {
    admin: true,
  });
};
