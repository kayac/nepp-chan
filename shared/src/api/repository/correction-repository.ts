import type { ApiClient } from "../create-client";

type CreateCorrectionParams = {
  correctsSourcePath: string;
  body: string;
  relatedFeedbackId?: string;
  answerRunId?: string;
};

export const createCorrectionRepository = (client: ApiClient) => ({
  fetchCorrections: async () => {
    const { data, error } = await client.GET("/admin/corrections");
    if (error) throw error;
    return data;
  },

  createCorrection: async (body: CreateCorrectionParams) => {
    const { data, error } = await client.POST("/admin/corrections", { body });
    if (error) throw error;
    return data;
  },

  publishCorrection: async (id: string) => {
    const { data, error } = await client.POST(
      "/admin/corrections/{id}/publish",
      { params: { path: { id } } },
    );
    if (error) throw error;
    return data;
  },

  retireCorrection: async (id: string) => {
    const { data, error } = await client.POST(
      "/admin/corrections/{id}/retire",
      { params: { path: { id } } },
    );
    if (error) throw error;
    return data;
  },

  reverifyCorrection: async (id: string) => {
    const { data, error } = await client.POST(
      "/admin/corrections/{id}/reverify",
      { params: { path: { id } } },
    );
    if (error) throw error;
    return data;
  },
});

export type CorrectionRepository = ReturnType<
  typeof createCorrectionRepository
>;
