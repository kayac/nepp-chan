import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { reviewRepository } from "~/lib/api/repository";
import type { ReviewDecisionType } from "~/types";
import { dashboardKeys } from "./keys";

export const useReviewQueue = (limit = 30, options?: { decided?: boolean }) =>
  useInfiniteQuery({
    queryKey: [...dashboardKeys.reviewQueue, limit, options?.decided],
    queryFn: ({ pageParam }) =>
      reviewRepository.fetchQueue({
        limit,
        cursor: pageParam,
        decided: options?.decided,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const useReviewDetail = (answerRunId: string | null) =>
  useQuery({
    queryKey: dashboardKeys.reviewDetail(answerRunId ?? ""),
    queryFn: () => {
      if (!answerRunId) throw new Error("answerRunId is required");
      return reviewRepository.fetchDetail(answerRunId);
    },
    enabled: !!answerRunId,
  });

const useInvalidateReview = () => {
  const queryClient = useQueryClient();
  return (answerRunId: string) => {
    queryClient.invalidateQueries({ queryKey: dashboardKeys.reviewQueue });
    queryClient.invalidateQueries({
      queryKey: dashboardKeys.reviewDetail(answerRunId),
    });
    queryClient.invalidateQueries({ queryKey: dashboardKeys.feedbacks });
  };
};

export const useUndoReviewDecision = () => {
  const invalidate = useInvalidateReview();
  return useMutation({
    mutationFn: (answerRunId: string) =>
      reviewRepository.undoDecision(answerRunId),
    onSuccess: (_data, answerRunId) => invalidate(answerRunId),
  });
};

export const useSubmitReviewDecision = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      answerRunId: string;
      decision: ReviewDecisionType;
      comment?: string;
    }) => reviewRepository.submitDecision(params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.reviewQueue });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.reviewDetail(variables.answerRunId),
      });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.feedbacks });
    },
  });
};
