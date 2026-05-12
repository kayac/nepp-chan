import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useConvertFile,
  useDeleteFile,
  useDeleteKnowledge,
  useKnowledgeFile,
  useKnowledgeFiles,
  useReconvertFile,
  useSaveFile,
  useSyncKnowledge,
  useUnifiedFiles,
  useUploadFile,
} from "./useKnowledge";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("useKnowledgeFile", () => {
  it("key=null なら fetchStatus は idle", () => {
    const { result } = renderHookWithQuery(() => useKnowledgeFile(null));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("key 指定時に fetch される", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files/doc.md`, () =>
        HttpResponse.json({ content: "# title" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useKnowledgeFile("doc.md"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.content).toBe("# title");
  });
});

describe("useKnowledgeFiles / useUnifiedFiles", () => {
  it("useKnowledgeFiles: 200 を返したら data に反映", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files`, () =>
        HttpResponse.json({ files: [] }),
      ),
    );

    const { result } = renderHookWithQuery(() => useKnowledgeFiles());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.files).toEqual([]);
  });

  it("useUnifiedFiles", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/unified`, () =>
        HttpResponse.json({ files: [] }),
      ),
    );

    const { result } = renderHookWithQuery(() => useUnifiedFiles());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("knowledge mutations", () => {
  it("useSyncKnowledge: 単純 mutation", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/sync`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useSyncKnowledge());

    await act(async () => {
      await result.current.mutateAsync();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useDeleteKnowledge: 単純 mutation", async () => {
    server.use(
      http.delete(`${API}/admin/knowledge`, () =>
        HttpResponse.json({ message: "deleted" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useDeleteKnowledge());

    await act(async () => {
      await result.current.mutateAsync();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useSaveFile: 成功で isSuccess", async () => {
    server.use(
      http.put(`${API}/admin/knowledge/files/doc.md`, () =>
        HttpResponse.json({ message: "saved" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useSaveFile());

    await act(async () => {
      await result.current.mutateAsync({ key: "doc.md", content: "# x" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useDeleteFile: 成功で isSuccess", async () => {
    server.use(
      http.delete(`${API}/admin/knowledge/files/doc.md`, () =>
        HttpResponse.json({ message: "deleted" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useDeleteFile());

    await act(async () => {
      await result.current.mutateAsync("doc.md");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useUploadFile / useConvertFile / useReconvertFile はインスタンス化できる", () => {
    const upload = renderHookWithQuery(() => useUploadFile());
    expect(typeof upload.result.current.mutateAsync).toBe("function");

    const convert = renderHookWithQuery(() => useConvertFile());
    expect(typeof convert.result.current.mutateAsync).toBe("function");

    const reconvert = renderHookWithQuery(() => useReconvertFile());
    expect(typeof reconvert.result.current.mutateAsync).toBe("function");
  });
});
