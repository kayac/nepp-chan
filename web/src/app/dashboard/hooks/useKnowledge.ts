import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { knowledgeRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

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

const invalidateKnowledge = (
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  queryClient.invalidateQueries({ queryKey: dashboardKeys.knowledgeFiles });
  queryClient.invalidateQueries({
    queryKey: dashboardKeys.knowledgeUnifiedFiles,
  });
};

export const useSaveFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, content }: { key: string; content: string }) =>
      knowledgeRepository.saveFile(key, content),
    onSuccess: () => invalidateKnowledge(queryClient),
  });
};

export const useDeleteFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: knowledgeRepository.deleteFile,
    onSuccess: () => invalidateKnowledge(queryClient),
  });
};

export const useUploadFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, filename }: { file: File; filename?: string }) =>
      knowledgeRepository.uploadFile(file, filename),
    onSuccess: () => invalidateKnowledge(queryClient),
  });
};

export const useConvertFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, filename }: { file: File; filename: string }) =>
      knowledgeRepository.convertFile(file, filename),
    onSuccess: () => invalidateKnowledge(queryClient),
  });
};

export const useUnifiedFiles = () =>
  useQuery({
    queryKey: dashboardKeys.knowledgeUnifiedFiles,
    queryFn: knowledgeRepository.fetchUnifiedFiles,
  });

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
