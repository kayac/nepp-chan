import { API_BASE, apiClient } from "~/lib/api/client";
import type {
  ConvertFileResponse,
  DeleteResult,
  FileContentResponse,
  FilesListResponse,
  SaveFileResponse,
  SyncResult,
  UploadFileResponse,
} from "~/types";

// 全ナレッジ同期
export const syncKnowledge = (): Promise<SyncResult> =>
  apiClient<SyncResult>("/admin/knowledge/sync", {
    method: "POST",
    admin: true,
  });

export const deleteAllKnowledge = (): Promise<DeleteResult> =>
  apiClient<DeleteResult>("/admin/knowledge", {
    method: "DELETE",
    admin: true,
  });

// ファイル一覧取得
export const fetchFiles = (): Promise<FilesListResponse> =>
  apiClient<FilesListResponse>("/admin/knowledge/files", {
    admin: true,
  });

// ファイル内容取得
export const fetchFileContent = (key: string): Promise<FileContentResponse> =>
  apiClient<FileContentResponse>(
    `/admin/knowledge/files/${encodeURIComponent(key)}`,
    { admin: true },
  );

// ファイル保存
export const saveFile = (
  key: string,
  content: string,
): Promise<SaveFileResponse> =>
  apiClient<SaveFileResponse>(
    `/admin/knowledge/files/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      body: { content },
      admin: true,
    },
  );

// ファイル削除
export const deleteFile = (key: string): Promise<DeleteResult> =>
  apiClient<DeleteResult>(`/admin/knowledge/files/${encodeURIComponent(key)}`, {
    method: "DELETE",
    admin: true,
  });

// ファイルアップロード（multipart/form-data）
export const uploadFile = async (
  file: File,
  filename?: string,
): Promise<UploadFileResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  if (filename) {
    formData.append("filename", filename);
  }

  const adminKey = import.meta.env.VITE_ADMIN_KEY || "";
  const res = await fetch(`${API_BASE}/admin/knowledge/upload`, {
    method: "POST",
    headers: { "X-Admin-Key": adminKey },
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "アップロードに失敗しました");
  }

  return res.json();
};

// 画像/PDF → Markdown 変換
export const convertFile = async (
  file: File,
  filename: string,
): Promise<ConvertFileResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", filename);

  const adminKey = import.meta.env.VITE_ADMIN_KEY || "";
  const res = await fetch(`${API_BASE}/admin/knowledge/convert`, {
    method: "POST",
    headers: { "X-Admin-Key": adminKey },
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "変換に失敗しました");
  }

  return res.json();
};
