import type { ApiClient } from "../create-client";

export const createAdminUserRepository = (client: ApiClient) => ({
  deleteAdminUser: async (id: string) => {
    const { error } = await client.DELETE("/admin/users/{id}", {
      params: { path: { id } },
    });
    if (error) throw error;
  },
});

export type AdminUserRepository = ReturnType<typeof createAdminUserRepository>;
