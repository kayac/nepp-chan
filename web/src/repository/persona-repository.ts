import { client } from "~/lib/api/client";

type FetchPersonasParams = {
  limit?: number;
  cursor?: string;
};

export const fetchPersonas = async (params: FetchPersonasParams = {}) => {
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
};

export const extractPersonas = async () => {
  const { data, error } = await client.POST("/admin/persona/extract");
  if (error) throw error;
  return data;
};

export const deleteAllPersonas = async () => {
  const { data, error } = await client.DELETE("/admin/persona");
  if (error) throw error;
  return data;
};
