import type { ApiClient } from "../create-client";

export type PersonaSentiment = "positive" | "negative" | "request" | "neutral";

export type PersonaFilterParams = {
  from?: string;
  to?: string;
  sentiments?: PersonaSentiment[];
  topic?: string;
};

export type FetchPersonasParams = PersonaFilterParams & {
  limit?: number;
  cursor?: string;
};

const toQuery = (params: PersonaFilterParams) => ({
  from: params.from,
  to: params.to,
  sentiments:
    params.sentiments && params.sentiments.length > 0
      ? params.sentiments.join(",")
      : undefined,
  topic: params.topic,
});

export const createPersonaRepository = (client: ApiClient) => ({
  fetchPersonas: async (params: FetchPersonasParams = {}) => {
    const { data, error } = await client.GET("/admin/persona", {
      params: {
        query: {
          limit: params.limit ?? 30,
          cursor: params.cursor,
          ...toQuery(params),
        },
      },
    });
    if (error) throw error;
    return data;
  },

  fetchPersonaTopics: async (params: PersonaFilterParams = {}) => {
    const { data, error } = await client.GET("/admin/persona/topics", {
      params: { query: toQuery(params) },
    });
    if (error) throw error;
    return data;
  },
});

export type PersonaRepository = ReturnType<typeof createPersonaRepository>;
