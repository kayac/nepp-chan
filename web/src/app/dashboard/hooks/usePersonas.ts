import type { PersonaFilterParams } from "@nepp-chan/shared/api/repository/persona-repository";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";

import { personaRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

export const PERSONA_PAGE_SIZE = 30;

export const usePersonas = (
  filters: PersonaFilterParams,
  options: { enabled?: boolean } = {},
) =>
  useInfiniteQuery({
    queryKey: dashboardKeys.personaList(filters),
    queryFn: ({ pageParam }) =>
      personaRepository.fetchPersonas({
        ...filters,
        limit: PERSONA_PAGE_SIZE,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });

export const usePersonaTopics = (
  filters: PersonaFilterParams,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: dashboardKeys.personaTopics(filters),
    queryFn: () => personaRepository.fetchPersonaTopics(filters),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });
