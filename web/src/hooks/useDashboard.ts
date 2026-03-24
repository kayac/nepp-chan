import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createBroadcast,
  deleteBroadcast,
  fetchBroadcasts,
  sendBroadcastNow,
  updateBroadcast,
  uploadBroadcastImage,
} from "~/repository/broadcast-repository";
import { fetchEmergencies } from "~/repository/emergency-repository";
import {
  deleteAllFeedbacks,
  fetchFeedbackById,
  fetchFeedbacks,
  resolveFeedback,
  unresolveFeedback,
} from "~/repository/feedback-repository";
import {
  convertFile,
  deleteAllKnowledge,
  deleteFile,
  fetchFileContent,
  fetchFiles,
  fetchUnifiedFiles,
  reconvertFile,
  saveFile,
  syncKnowledge,
  uploadFile,
} from "~/repository/knowledge-repository";
import {
  deleteAllPersonas,
  extractPersonas,
  fetchPersonas,
} from "~/repository/persona-repository";

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
};

export const usePersonas = (limit = 30) =>
  useInfiniteQuery({
    queryKey: [...dashboardKeys.personas, limit],
    queryFn: ({ pageParam }) => fetchPersonas({ limit, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const useEmergencies = (limit = 100) =>
  useQuery({
    queryKey: dashboardKeys.emergencies,
    queryFn: () => fetchEmergencies(limit),
  });

export const useSyncKnowledge = () =>
  useMutation({
    mutationFn: syncKnowledge,
  });

export const useDeleteKnowledge = () =>
  useMutation({
    mutationFn: deleteAllKnowledge,
  });

export const useExtractPersonas = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: extractPersonas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.personas });
    },
  });
};

export const useDeletePersonas = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAllPersonas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.personas });
    },
  });
};

// ナレッジファイル関連 hooks
export const useKnowledgeFiles = () =>
  useQuery({
    queryKey: dashboardKeys.knowledgeFiles,
    queryFn: fetchFiles,
  });

export const useKnowledgeFile = (key: string | null) =>
  useQuery({
    queryKey: dashboardKeys.knowledgeFile(key ?? ""),
    queryFn: () => {
      if (!key) throw new Error("Key is required");
      return fetchFileContent(key);
    },
    enabled: !!key,
  });

export const useSaveFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, content }: { key: string; content: string }) =>
      saveFile(key, content),
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
    mutationFn: deleteFile,
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
      uploadFile(file, filename),
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
      convertFile(file, filename),
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
    queryFn: fetchUnifiedFiles,
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
    }) => reconvertFile(originalKey, filename),
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
      fetchFeedbacks({ limit, cursor: pageParam, rating: options?.rating }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const useFeedbackDetail = (id: string | null) =>
  useQuery({
    queryKey: dashboardKeys.feedbackDetail(id ?? ""),
    queryFn: () => {
      if (!id) throw new Error("ID is required");
      return fetchFeedbackById(id);
    },
    enabled: !!id,
  });

export const useDeleteFeedbacks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAllFeedbacks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.feedbacks });
    },
  });
};

export const useResolveFeedback = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resolveFeedback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.feedbacks });
    },
  });
};

export const useUnresolveFeedback = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unresolveFeedback,
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
      fetchBroadcasts({ limit, cursor: pageParam, status: options?.status }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export const useCreateBroadcast = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBroadcast,
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
      data: Parameters<typeof updateBroadcast>[1];
    }) => updateBroadcast(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.broadcasts });
    },
  });
};

export const useDeleteBroadcast = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBroadcast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.broadcasts });
    },
  });
};

export const useSendBroadcast = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendBroadcastNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.broadcasts });
    },
  });
};

export const useUploadBroadcastImage = () =>
  useMutation({ mutationFn: uploadBroadcastImage });
