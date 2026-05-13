import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { broadcastRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

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
