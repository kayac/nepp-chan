import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { pollRepository } from "~/lib/api/repository";
import type { PollStatus } from "~/types";
import { dashboardKeys } from "./keys";

export const usePolls = (limit = 30, options?: { status?: PollStatus }) =>
  useInfiniteQuery({
    queryKey: [...dashboardKeys.polls, limit, options?.status],
    queryFn: ({ pageParam }) =>
      pollRepository.fetchPolls({
        limit,
        cursor: pageParam,
        status: options?.status,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const useCreatePoll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pollRepository.createPoll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.polls });
    },
  });
};

export const useUpdatePoll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof pollRepository.updatePoll>[1];
    }) => pollRepository.updatePoll(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.polls });
    },
  });
};

export const useDeletePoll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pollRepository.deletePoll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.polls });
    },
  });
};

export const useSendPoll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pollRepository.sendPollNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.polls });
    },
  });
};

export const useClosePoll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pollRepository.closePoll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.polls });
    },
  });
};

export const usePollResults = (id: string | null) =>
  useQuery({
    queryKey: dashboardKeys.pollResults(id ?? ""),
    queryFn: () => {
      if (!id) throw new Error("ID is required");
      return pollRepository.fetchPollResultsAdmin(id);
    },
    enabled: !!id,
  });
