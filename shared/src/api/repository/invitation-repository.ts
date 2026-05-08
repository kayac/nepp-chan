import type { ApiClient } from "../create-client";
import type { paths } from "../types";

type CreateInvitationBody = NonNullable<
  paths["/admin/invitations"]["post"]["requestBody"]
>["content"]["application/json"];
type AdminRole = CreateInvitationBody["role"];

export const createInvitationRepository = (client: ApiClient) => ({
  fetchInvitations: async () => {
    const { data, error } = await client.GET("/admin/invitations");
    if (error) throw error;
    return data;
  },

  createInvitation: async (username: string, role: AdminRole) => {
    const { data, error } = await client.POST("/admin/invitations", {
      body: { username, role },
    });
    if (error) throw error;
    return data;
  },

  deleteInvitation: async (id: string) => {
    const { error } = await client.DELETE("/admin/invitations/{id}", {
      params: { path: { id } },
    });
    if (error) throw error;
  },
});

export type InvitationRepository = ReturnType<
  typeof createInvitationRepository
>;
