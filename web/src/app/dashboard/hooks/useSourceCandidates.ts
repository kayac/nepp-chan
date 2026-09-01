import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { sourceCandidateRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

export const useSourceCandidates = () =>
  useQuery({
    queryKey: dashboardKeys.sourceCandidates,
    queryFn: sourceCandidateRepository.fetchSourceCandidates,
  });

export const useUpdateSourceCandidateStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sourceCandidateRepository.updateSourceCandidateStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.sourceCandidates,
      });
    },
  });
};
