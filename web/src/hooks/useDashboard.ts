import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  broadcastRepository,
  emergencyRepository,
  feedbackRepository,
  knowledgeRepository,
  personaRepository,
  pollRepository,
} from "~/lib/api/repository";
import type { PollStatus } from "~/types";

export const dashboardKeys = {
  broadcasts: ["dashboard", "broadcasts"] as const,
  broadcastDetail: (id: string) => ["dashboard", "broadcast", id] as const,
  personas: ["dashboard", "personas"] as const,
  emergencies: ["dashboard", "emergencies"] as const,
  feedbacks: ["dashboard", "feedbacks"] as const,
  feedbackDetail: (id: string) => ["dashboard", "feedback", id] as const,
  knowledgeFiles: ["dashboard", "knowledge", "files"] as const,
  knowledgeUnifiedFiles: ["dashboard", "knowledge", "unified"] as const,
  knowledgeFile: (key: string) =>
    ["dashboard", "knowledge", "file", key] as const,
  polls: ["dashboard", "polls"] as const,
  pollResults: (id: string) => ["dashboard", "poll", "results", id] as const,
};

export const usePersonas = (limit = 30) =>
  useInfiniteQuery({
    queryKey: [...dashboardKeys.personas, limit],
    queryFn: ({ pageParam }) =>
      personaRepository.fetchPersonas({ limit, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const useEmergencies = (limit = 100) =>
  useQuery({
    queryKey: dashboardKeys.emergencies,
    queryFn: () => emergencyRepository.fetchEmergencies(limit),
  });

export const useSyncKnowledge = () =>
  useMutation({
    mutationFn: knowledgeRepository.syncKnowledge,
  });

export const useDeleteKnowledge = () =>
  useMutation({
    mutationFn: knowledgeRepository.deleteAllKnowledge,
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

// ナレッジファイル関連 hooks
export const useKnowledgeFiles = () =>
  useQuery({
    queryKey: dashboardKeys.knowledgeFiles,
    queryFn: knowledgeRepository.fetchFiles,
  });

export const useKnowledgeFile = (key: string | null) =>
  useQuery({
    queryKey: dashboardKeys.knowledgeFile(key ?? ""),
    queryFn: () => {
      if (!key) throw new Error("Key is required");
      return knowledgeRepository.fetchFileContent(key);
    },
    enabled: !!key,
  });

export const useSaveFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, content }: { key: string; content: string }) =>
      knowledgeRepository.saveFile(key, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.knowledgeFiles });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.knowledgeUnifiedFiles,
      });
    },
  });
};

export const useDeleteFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: knowledgeRepository.deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.knowledgeFiles });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.knowledgeUnifiedFiles,
      });
    },
  });
};

export const useUploadFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, filename }: { file: File; filename?: string }) =>
      knowledgeRepository.uploadFile(file, filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.knowledgeFiles });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.knowledgeUnifiedFiles,
      });
    },
  });
};

export const useConvertFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, filename }: { file: File; filename: string }) =>
      knowledgeRepository.convertFile(file, filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.knowledgeFiles });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.knowledgeUnifiedFiles,
      });
    },
  });
};

// 統合ファイル一覧
export const useUnifiedFiles = () =>
  useQuery({
    queryKey: dashboardKeys.knowledgeUnifiedFiles,
    queryFn: knowledgeRepository.fetchUnifiedFiles,
  });

// 元ファイルからMarkdownを再生成
export const useReconvertFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      originalKey,
      filename,
    }: {
      originalKey: string;
      filename: string;
    }) => knowledgeRepository.reconvertFile(originalKey, filename),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.knowledgeUnifiedFiles,
      });
    },
  });
};

// フィードバック関連 hooks
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
