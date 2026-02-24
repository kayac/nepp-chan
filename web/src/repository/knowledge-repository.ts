import { API_BASE, apiClient } from "~/lib/api/client";
import { getAuthToken } from "~/lib/auth-token";
import type {
  ConvertFileResponse,
  DeleteResult,
  FileContentResponse,
  FilesListResponse,
  ReconvertFileResponse,
  SaveFileResponse,
  SyncResult,
  UnifiedFilesListResponse,
  UploadFileResponse,
} from "~/types";

// 全ナレッジ同期
export const syncKnowledge = () =>
  apiClient<SyncResult>("/admin/knowledge/sync", {
    method: "POST",
  });

export const deleteAllKnowledge = () =>
  apiClient<DeleteResult>("/admin/knowledge", {
    method: "DELETE",
  });

// ファイル一覧取得
export const fetchFiles = () =>
  apiClient<FilesListResponse>("/admin/knowledge/files");

// ファイル内容取得
export const fetchFileContent = (key: string) =>
  apiClient<FileContentResponse>(
    `/admin/knowledge/files/${encodeURIComponent(key)}`,
  );

// ファイル保存
export const saveFile = (key: string, content: string) =>
  apiClient<SaveFileResponse>(
    `/admin/knowledge/files/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      body: { content },
    },
  );

// ファイル削除
export const deleteFile = (key: string) =>
  apiClient<DeleteResult>(`/admin/knowledge/files/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });

// ファイルアップロード（multipart/form-data）
export const uploadFile = async (file: File, filename?: string) => {
  const formData = new FormData();
  formData.append("file", file);
  if (filename) {
    formData.append("filename", filename);
  }

  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/admin/knowledge/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || "アップロードに失敗しました");
  }

  return res.json() as Promise<UploadFileResponse>;
};

// 画像/PDF → Markdown 変換
export const convertFile = async (file: File, filename: string) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", filename);

  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/admin/knowledge/convert`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || "変換に失敗しました");
  }

  return res.json() as Promise<ConvertFileResponse>;
};

// 統合ファイル一覧取得
export const fetchUnifiedFiles = () =>
  apiClient<UnifiedFilesListResponse>("/admin/knowledge/unified");

// 元ファイルURL取得
export const getOriginalFileUrl = (key: string) => {
  const encodedKey = encodeURIComponent(key.replace("originals/", ""));
  return `${API_BASE}/admin/knowledge/originals/${encodedKey}`;
};

// 元ファイルからMarkdownを再生成
export const reconvertFile = (originalKey: string, filename: string) =>
  apiClient<ReconvertFileResponse>("/admin/knowledge/reconvert", {
    method: "POST",
    body: { originalKey, filename },
  });
