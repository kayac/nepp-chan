import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { knowledgeRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

export const useKnowledgeSources = () =>
  useQuery({
    queryKey: dashboardKeys.knowledgeSources,
    queryFn: knowledgeRepository.fetchSources,
  });

export const useUpdateSourceStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: knowledgeRepository.updateSourceStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.knowledgeSources,
      });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.corrections });
    },
  });
};

export const useBackfillSources = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: knowledgeRepository.backfillSources,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.knowledgeSources,
      });
    },
  });
};
