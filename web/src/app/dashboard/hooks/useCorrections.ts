import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { correctionRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

export const useCorrections = () =>
  useQuery({
    queryKey: dashboardKeys.corrections,
    queryFn: correctionRepository.fetchCorrections,
  });

const useInvalidateCorrections = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: dashboardKeys.corrections });
    queryClient.invalidateQueries({ queryKey: dashboardKeys.reviewQueue });
  };
};

export const useCreateCorrection = () => {
  const invalidate = useInvalidateCorrections();
  return useMutation({
    mutationFn: correctionRepository.createCorrection,
    onSuccess: invalidate,
  });
};

export const usePublishCorrection = () => {
  const invalidate = useInvalidateCorrections();
  return useMutation({
    mutationFn: correctionRepository.publishCorrection,
    onSuccess: invalidate,
  });
};

export const useRetireCorrection = () => {
  const invalidate = useInvalidateCorrections();
  return useMutation({
    mutationFn: correctionRepository.retireCorrection,
    onSuccess: invalidate,
  });
};

export const useReverifyCorrection = () => {
  const invalidate = useInvalidateCorrections();
  return useMutation({
    mutationFn: correctionRepository.reverifyCorrection,
    onSuccess: invalidate,
  });
};
