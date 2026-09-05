import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useConvertFile,
  useDeleteFile,
  useKnowledgeFile,
  useKnowledgeFiles,
  useReconvertFile,
  useSaveFile,
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

  it("useUploadFile: 成功で isSuccess", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/upload`, () =>
        HttpResponse.json({ key: "k", chunks: 1 }),
      ),
    );

    const { result } = renderHookWithQuery(() => useUploadFile());

    await act(async () => {
      await result.current.mutateAsync({
        file: new File(["x"], "f.md"),
        filename: "f.md",
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useConvertFile: 成功で isSuccess", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/convert`, () =>
        HttpResponse.json({ key: "k", chunks: 1, originalType: "image/png" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useConvertFile());

    await act(async () => {
      await result.current.mutateAsync({
        file: new File(["x"], "f.png", { type: "image/png" }),
        filename: "f",
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useReconvertFile: 成功で isSuccess", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/reconvert`, () =>
        HttpResponse.json({ key: "k", chunks: 1 }),
      ),
    );

    const { result } = renderHookWithQuery(() => useReconvertFile());

    await act(async () => {
      await result.current.mutateAsync({
        originalKey: "originals/x.pdf",
        filename: "x",
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
