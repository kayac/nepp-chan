import { API_BASE, client } from "~/lib/api/client";

export const syncKnowledge = async () => {
  const { data, error } = await client.POST("/admin/knowledge/sync");
  if (error) throw error;
  return data;
};

export const deleteAllKnowledge = async () => {
  const { data, error } = await client.DELETE("/admin/knowledge");
  if (error) throw error;
  return data;
};

export const fetchFiles = async () => {
  const { data, error } = await client.GET("/admin/knowledge/files");
  if (error) throw error;
  return data;
};

export const fetchFileContent = async (key: string) => {
  const { data, error } = await client.GET("/admin/knowledge/files/{key}", {
    params: { path: { key } },
  });
  if (error) throw error;
  return data;
};

export const saveFile = async (key: string, content: string) => {
  const { data, error } = await client.PUT("/admin/knowledge/files/{key}", {
    params: { path: { key } },
    body: { content },
  });
  if (error) throw error;
  return data;
};

export const deleteFile = async (key: string) => {
  const { data, error } = await client.DELETE("/admin/knowledge/files/{key}", {
    params: { path: { key } },
  });
  if (error) throw error;
  return data;
};

export const uploadFile = async (file: File, filename?: string) => {
  const { data, error } = await client.POST("/admin/knowledge/upload", {
    body: { file: file as unknown as string, filename },
    bodySerializer: toFormData,
  });
  if (error) throw error;
  return data;
};

export const convertFile = async (file: File, filename: string) => {
  const { data, error } = await client.POST("/admin/knowledge/convert", {
    body: { file: file as unknown as string, filename },
    bodySerializer: toFormData,
  });
  if (error) throw error;
  return data;
};

const toFormData = (body: unknown) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value != null) fd.append(key, value as string | Blob);
  }
  return fd;
};

export const fetchUnifiedFiles = async () => {
  const { data, error } = await client.GET("/admin/knowledge/unified");
  if (error) throw error;
  return data;
};

export const getOriginalFileUrl = (key: string) => {
  const encodedKey = encodeURIComponent(key.replace("originals/", ""));
  return `${API_BASE}/admin/knowledge/originals/${encodedKey}`;
};

export const reconvertFile = async (originalKey: string, filename: string) => {
  const { data, error } = await client.POST("/admin/knowledge/reconvert", {
    body: { originalKey, filename },
  });
  if (error) throw error;
  return data;
};
