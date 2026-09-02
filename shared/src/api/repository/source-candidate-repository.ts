import type { ApiClient } from "../create-client";

export const createSourceCandidateRepository = (client: ApiClient) => ({
  fetchSourceCandidates: async () => {
    const { data, error } = await client.GET("/admin/source-candidates");
    if (error) throw error;
    return data;
  },

  updateSourceCandidateStatus: async (params: {
    id: string;
    action: "approve" | "reject" | "reset";
  }) => {
    const { data, error } = await client.PATCH(
      "/admin/source-candidates/{id}/status",
      {
        params: { path: { id: params.id } },
        body: { action: params.action },
      },
    );
    if (error) throw error;
    return data;
  },
});

export type SourceCandidateRepository = ReturnType<
  typeof createSourceCandidateRepository
>;
