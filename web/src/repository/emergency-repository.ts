import { client } from "~/lib/api/client";

export const fetchEmergencies = async (limit = 100) => {
  const { data, error } = await client.GET("/admin/emergency", {
    params: { query: { limit } },
  });
  if (error) throw error;
  return data;
};
