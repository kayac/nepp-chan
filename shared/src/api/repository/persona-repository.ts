import type { ApiClient } from "../create-client";

export type PersonaSentiment = "positive" | "negative" | "request" | "neutral";
export type PersonaRelationship = "村人" | "観光客" | "移住検討者" | "帰省者";

export type FetchPersonasParams = {
  limit?: number;
  cursor?: string;
  from?: string;
  to?: string;
  sentiments?: PersonaSentiment[];
  relationships?: PersonaRelationship[];
  topic?: string;
};

const joinOrOmit = (values: string[] | undefined) =>
  values && values.length > 0 ? values.join(",") : undefined;

export const createPersonaRepository = (client: ApiClient) => ({
  fetchPersonas: async (params: FetchPersonasParams = {}) => {
    const { data, error } = await client.GET("/admin/persona", {
      params: {
        query: {
          limit: params.limit ?? 30,
          cursor: params.cursor,
          from: params.from,
          to: params.to,
          sentiments: joinOrOmit(params.sentiments),
          relationships: joinOrOmit(params.relationships),
          topic: params.topic,
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
