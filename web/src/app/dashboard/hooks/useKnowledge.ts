import { ApiError } from "@nepp-chan/shared/api";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { KnowledgePrefix } from "~/app/dashboard/components/knowledge/helpers";
import { runWithConcurrency } from "~/app/dashboard/components/knowledge/helpers";
import { knowledgeRepository } from "~/lib/api/repository";
import { dashboardKeys } from "./keys";

export const useKnowledgeFiles = (prefix: KnowledgePrefix, limit = 30) =>
  useInfiniteQuery({
    queryKey: [...dashboardKeys.knowledgeFilesByPrefix(prefix), limit],
    queryFn: ({ pageParam }) =>
      knowledgeRepository.fetchFiles({ prefix, limit, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
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

const isNotFound = (error: unknown) =>
  error instanceof ApiError && error.status === 404;

export const useKnowledgeFileExists = (key: string | null) =>
  useQuery({
    queryKey: dashboardKeys.knowledgeFileExists(key ?? ""),
    queryFn: async () => {
      if (!key) throw new Error("Key is required");
      try {
        await knowledgeRepository.fetchFileContent(key);
        return true;
      } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
      }
    },
    enabled: !!key,
    retry: false,
  });

const invalidateKnowledge = (
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  queryClient.invalidateQueries({ queryKey: dashboardKeys.knowledgeFiles });
  queryClient.invalidateQueries({
    queryKey: dashboardKeys.knowledgeFileContents,
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

export type UploadItem = { file: File; relativePath: string };
export type UploadFailure = UploadItem & { error: string };
export type UploadOutcome = { uploaded: number; failed: UploadFailure[] };

const UPLOAD_CONCURRENCY = 3;

export const useUploadFiles = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      items,
      onProgress,
    }: {
      items: UploadItem[];
      onProgress?: (done: number) => void;
    }): Promise<UploadOutcome> => {
      let done = 0;
      const results = await runWithConcurrency(
        items.map((item) => async () => {
          try {
            await knowledgeRepository.uploadFile(item.file, item.relativePath);
            return null;
          } catch (error) {
            return {
              ...item,
              error:
                error instanceof Error
                  ? error.message
                  : "アップロードに失敗しました",
            };
          } finally {
            done += 1;
            onProgress?.(done);
          }
        }),
        UPLOAD_CONCURRENCY,
      );
      const failed = results.filter((r): r is UploadFailure => r !== null);
      return { uploaded: items.length - failed.length, failed };
    },
    onSettled: () => invalidateKnowledge(queryClient),
  });
};

export const useSyncKnowledge = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: knowledgeRepository.syncAll,
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

export const useDraftCurated = () =>
  useMutation({
    mutationFn: knowledgeRepository.draftCurated,
  });
