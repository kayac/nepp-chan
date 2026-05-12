import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { broadcastRepository, pollRepository } from "~/lib/api/repository";
import type { PollStatus } from "~/types";
import { dashboardKeys } from "./dashboard/keys";

export { dashboardKeys };

// 配信メッセージ関連 hooks
export const useBroadcasts = (
  limit = 30,
  options?: { status?: "draft" | "scheduled" | "sent" | "failed" },
) =>
  useInfiniteQuery({
    queryKey: [...dashboardKeys.broadcasts, limit, options?.status],
    queryFn: ({ pageParam }) =>
      broadcastRepository.fetchBroadcasts({
        limit,
        cursor: pageParam,
        status: options?.status,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const useCreateBroadcast = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: broadcastRepository.createBroadcast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.broadcasts });
    },
  });
};

export const useUpdateBroadcast = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof broadcastRepository.updateBroadcast>[1];
    }) => broadcastRepository.updateBroadcast(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.broadcasts });
    },
  });
};

export const useDeleteBroadcast = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: broadcastRepository.deleteBroadcast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.broadcasts });
    },
  });
};

export const useSendBroadcast = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: broadcastRepository.sendBroadcastNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.broadcasts });
    },
  });
};

export const useUploadBroadcastImage = () =>
  useMutation({ mutationFn: broadcastRepository.uploadBroadcastImage });

// 投票関連 hooks
export const usePolls = (
  limit = 30,
  options?: {
    status?: PollStatus;
  },
) =>
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
