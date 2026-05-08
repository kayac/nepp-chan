import type { ApiClient } from "../create-client";

export const createEmergencyRepository = (client: ApiClient) => ({
  fetchEmergencies: async (limit = 100) => {
    const { data, error } = await client.GET("/admin/emergency", {
      params: { query: { limit } },
    });
    if (error) throw error;
    return data;
  },
});

export type EmergencyRepository = ReturnType<typeof createEmergencyRepository>;
