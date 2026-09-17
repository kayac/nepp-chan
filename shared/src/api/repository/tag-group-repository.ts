import type { ApiClient } from "../create-client";

export const createTagGroupRepository = (client: ApiClient) => ({
  fetchTagGroups: async () => {
    const { data, error } = await client.GET("/admin/tag-groups");
    if (error) throw error;
    return data;
  },

  setTagAlias: async (tag: string, groupId: string | null) => {
    const { data, error } = await client.PUT(
      "/admin/tag-groups/aliases/{tag}",
      {
        params: { path: { tag } },
        body: { groupId },
      },
    );
    if (error) throw error;
    return data;
  },

  assignTagGroups: async () => {
    const { data, error } = await client.POST("/admin/tag-groups/assign");
    if (error) throw error;
    return data;
  },
});
