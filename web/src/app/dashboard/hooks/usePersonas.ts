import type { FetchPersonasParams } from "@nepp-chan/shared/api/repository/persona-repository";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { personaRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

type PersonaFilters = Omit<FetchPersonasParams, "limit" | "cursor">;

export const usePersonas = (
  limit = 30,
  filters: PersonaFilters = {},
  options: { enabled?: boolean } = {},
) =>
  useInfiniteQuery({
    queryKey: [...dashboardKeys.personas, limit, filters],
    queryFn: ({ pageParam }) =>
      personaRepository.fetchPersonas({ ...filters, limit, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });

export const useExtractPersonas = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: personaRepository.extractPersonas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.personas });
    },
  });
};

export const useDeletePersonas = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: personaRepository.deleteAllPersonas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.personas });
    },
  });
};
