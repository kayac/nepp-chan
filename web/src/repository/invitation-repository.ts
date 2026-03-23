import { client } from "~/lib/api/client";

export const fetchInvitations = async () => {
  const { data, error } = await client.GET("/admin/invitations");
  if (error) throw error;
  return data;
};

export const createInvitation = async (username: string) => {
  const { data, error } = await client.POST("/admin/invitations", {
    body: { username },
  });
  if (error) throw error;
  return data;
};

export const deleteInvitation = async (id: string) => {
  const { error } = await client.DELETE("/admin/invitations/{id}", {
    params: { path: { id } },
  });
  if (error) throw error;
};
