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

  fetchOntology: async () => {
    const { data, error } = await client.GET("/admin/analytics/ontology");
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

  fetchUsageAnalytics: async (days = 30) => {
    const { data, error } = await client.GET("/admin/analytics/usage", {
      params: { query: { days } },
    });
    if (error) throw error;
    return data;
  },

  fetchThreadUsage: async (params: { days?: number; limit?: number } = {}) => {
    const { data, error } = await client.GET("/admin/analytics/usage/threads", {
      params: { query: params },
    });
    if (error) throw error;
    return data;
  },

  fetchOperationCost: async (days = 30) => {
    const { data, error } = await client.GET(
      "/admin/analytics/usage/operation",
      {
        params: { query: { days } },
      },
    );
    if (error) throw error;
    return data;
  },

  fetchThreadTurnUsage: async (threadId: string) => {
    const { data, error } = await client.GET(
      "/admin/analytics/usage/threads/{threadId}",
      { params: { path: { threadId } } },
    );
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
