import type { ApiClient } from "../create-client";

type FetchPersonasParams = {
  limit?: number;
  cursor?: string;
};

export const createPersonaRepository = (client: ApiClient) => ({
  fetchPersonas: async (params: FetchPersonasParams = {}) => {
    const { data, error } = await client.GET("/admin/persona", {
      params: {
        query: {
          limit: params.limit ?? 30,
          cursor: params.cursor,
        },
      },
    });
    if (error) throw error;
    return data;
  },

  extractPersonas: async () => {
    const { data, error } = await client.POST("/admin/persona/extract");
    if (error) throw error;
    return data;
  },

  deleteAllPersonas: async () => {
    const { data, error } = await client.DELETE("/admin/persona");
    if (error) throw error;
    return data;
  },
});

export type PersonaRepository = ReturnType<typeof createPersonaRepository>;
