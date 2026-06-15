import type { ApiClient } from "../create-client";

export const createAnalyticsRepository = (client: ApiClient) => ({
  fetchPersonaAnalytics: async (
    params: { from?: string; to?: string } = {},
  ) => {
    const { data, error } = await client.GET("/admin/analytics/persona", {
      params: { query: params },
    });
    if (error) throw error;
    return data;
  },

  fetchOntology: async (params: { from?: string; to?: string } = {}) => {
    const { data, error } = await client.GET("/admin/analytics/ontology", {
      params: { query: params },
    });
    if (error) throw error;
    return data;
  },

  fetchConversationAnalytics: async (days = 30) => {
    const { data, error } = await client.GET("/admin/analytics/conversations", {
      params: { query: { days } },
    });
    if (error) throw error;
    return data;
  },

  fetchUsageAnalytics: async (weeks = 12) => {
    const { data, error } = await client.GET("/admin/analytics/usage", {
      params: { query: { weeks } },
    });
    if (error) throw error;
    return data;
  },

  fetchWeeklyReports: async (limit = 12) => {
    const { data, error } = await client.GET("/admin/analytics/reports", {
      params: { query: { limit } },
    });
    if (error) throw error;
    return data;
  },

  fetchWeeklyReportById: async (id: string) => {
    const { data, error } = await client.GET("/admin/analytics/reports/{id}", {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  },
});

export type AnalyticsRepository = ReturnType<typeof createAnalyticsRepository>;
