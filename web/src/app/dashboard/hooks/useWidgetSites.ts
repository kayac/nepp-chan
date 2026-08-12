import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { widgetSiteRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

export const useWidgetSites = () =>
  useQuery({
    queryKey: dashboardKeys.widgetSites,
    queryFn: widgetSiteRepository.fetchWidgetSites,
  });

export const useCreateWidgetSite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: widgetSiteRepository.createWidgetSite,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dashboardKeys.widgetSites }),
  });
};

export const useUpdateWidgetSite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof widgetSiteRepository.updateWidgetSite>[1];
    }) => widgetSiteRepository.updateWidgetSite(id, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dashboardKeys.widgetSites }),
  });
};

export const useDeleteWidgetSite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: widgetSiteRepository.deleteWidgetSite,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dashboardKeys.widgetSites }),
  });
};
