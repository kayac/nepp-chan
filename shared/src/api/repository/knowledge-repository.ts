import type { KnowledgePrefix } from "../../constants/knowledge";
import type { ApiClient } from "../create-client";
import type { CuratedDraftRequest } from "../types";

export const toFormData = (body: unknown) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value == null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) fd.append(key, v as string | Blob);
  }
  return fd;
};

export type FetchFilesParams = {
  prefix: KnowledgePrefix;
  limit?: number;
  cursor?: string;
};

export const createKnowledgeRepository = (client: ApiClient) => ({
  fetchFiles: async (params: FetchFilesParams) => {
    const { data, error } = await client.GET("/admin/knowledge/files", {
      params: { query: params },
    });
    if (error) throw error;
    return data;
  },

  fetchFileContent: async (key: string) => {
    const { data, error } = await client.GET("/admin/knowledge/files/{key}", {
      params: { path: { key } },
    });
    if (error) throw error;
    return data;
  },

  saveFile: async (key: string, content: string) => {
    const { data, error } = await client.PUT("/admin/knowledge/files/{key}", {
      params: { path: { key } },
      body: { content },
    });
    if (error) throw error;
    return data;
  },

  deleteFile: async (key: string) => {
    const { data, error } = await client.DELETE(
      "/admin/knowledge/files/{key}",
      {
        params: { path: { key } },
      },
    );
    if (error) throw error;
    return data;
  },

  uploadFile: async (file: File, filename: string) => {
    const { data, error } = await client.POST("/admin/knowledge/upload", {
      body: { file: file as unknown as string, filename },
      bodySerializer: toFormData,
    });
    if (error) throw error;
    return data;
  },

  convertFile: async (file: File, filename: string) => {
    const { data, error } = await client.POST("/admin/knowledge/convert", {
      body: { file: file as unknown as string, filename },
      bodySerializer: toFormData,
    });
    if (error) throw error;
    return data;
  },

  syncAll: async () => {
    const { data, error } = await client.POST("/admin/knowledge/sync");
    if (error) throw error;
    return data;
  },

  draftCurated: async (request: CuratedDraftRequest) => {
    const { data, error } = await client.POST(
      "/admin/knowledge/curated-draft",
      {
        body: {
          urls: request.urls,
          text: request.text,
          files: request.files as unknown as string[],
        },
        bodySerializer: toFormData,
      },
    );
    if (error) throw error;
    return data;
  },

  reconvertFile: async (originalKey: string, filename: string) => {
    const { data, error } = await client.POST("/admin/knowledge/reconvert", {
      body: { originalKey, filename },
    });
    if (error) throw error;
    return data;
  },
});

export type KnowledgeRepository = ReturnType<typeof createKnowledgeRepository>;
