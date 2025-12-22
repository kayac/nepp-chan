import { apiClient } from "~/lib/api/client";
import type { DeleteResult, SyncResult } from "~/types";

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
