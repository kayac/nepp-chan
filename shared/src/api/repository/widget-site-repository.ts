import type { ApiClient } from "../create-client";
import type { paths } from "../types";

type WidgetSiteInput = NonNullable<
  paths["/admin/widget-sites"]["post"]["requestBody"]
>["content"]["application/json"];

export const createWidgetSiteRepository = (client: ApiClient) => ({
  fetchWidgetSites: async () => {
    const { data, error } = await client.GET("/admin/widget-sites");
    if (error) throw error;
    return data;
  },

  createWidgetSite: async (body: WidgetSiteInput) => {
    const { data, error } = await client.POST("/admin/widget-sites", { body });
    if (error) throw error;
    return data;
  },

  updateWidgetSite: async (id: string, body: WidgetSiteInput) => {
    const { data, error } = await client.PUT("/admin/widget-sites/{id}", {
      params: { path: { id } },
      body,
    });
    if (error) throw error;
    return data;
  },

  deleteWidgetSite: async (id: string) => {
    const { data, error } = await client.DELETE("/admin/widget-sites/{id}", {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  },
});

export type WidgetSiteRepository = ReturnType<
  typeof createWidgetSiteRepository
>;
