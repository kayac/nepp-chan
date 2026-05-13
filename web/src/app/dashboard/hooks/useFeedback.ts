import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { feedbackRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

export const useFeedbacks = (
  limit = 30,
  options?: { rating?: "good" | "bad" | "idea" },
) =>
  useInfiniteQuery({
    queryKey: [...dashboardKeys.feedbacks, limit, options?.rating],
    queryFn: ({ pageParam }) =>
      feedbackRepository.fetchFeedbacks({
        limit,
        cursor: pageParam,
        rating: options?.rating,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const useFeedbackDetail = (id: string | null) =>
  useQuery({
    queryKey: dashboardKeys.feedbackDetail(id ?? ""),
    queryFn: () => {
      if (!id) throw new Error("ID is required");
      return feedbackRepository.fetchFeedbackById(id);
    },
    enabled: !!id,
  });

export const useDeleteFeedbacks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: feedbackRepository.deleteAllFeedbacks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.feedbacks });
    },
  });
};

export const useResolveFeedback = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: feedbackRepository.resolveFeedback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.feedbacks });
    },
  });
};

export const useUnresolveFeedback = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: feedbackRepository.unresolveFeedback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.feedbacks });
    },
  });
};
