import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { knowledgeRepository } from "~/lib/api/repository";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useConvertFile,
  useDeleteFile,
  useDraftCurated,
  useKnowledgeFile,
  useKnowledgeFileExists,
  useKnowledgeFiles,
  useSaveFile,
  useSyncKnowledge,
  useUploadFiles,
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

describe("useKnowledgeFileExists", () => {
  it("200 なら true", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files/*`, () =>
        HttpResponse.json({ content: "# title" }),
      ),
    );

    const { result } = renderHookWithQuery(() =>
      useKnowledgeFileExists("curated/usagi.md"),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
  });

  it("404 なら再試行せず false", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/admin/knowledge/files/*`, () => {
        calls += 1;
        return HttpResponse.json(
          { error: { message: "File not found" } },
          { status: 404 },
        );
      }),
    );

    const { result } = renderHookWithQuery(() =>
      useKnowledgeFileExists("curated/missing.md"),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(false);
    expect(calls).toBe(1);
  });

  it("404 以外の失敗はエラーのまま", async () => {
    server.use(
      http.get(`${API}/admin/knowledge/files/*`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    const { result } = renderHookWithQuery(() =>
      useKnowledgeFileExists("curated/x.md"),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("key=null なら fetchStatus は idle", () => {
    const { result } = renderHookWithQuery(() => useKnowledgeFileExists(null));
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useKnowledgeFiles", () => {
  it("prefix と limit をクエリに載せ、nextCursor で次ページを取る", async () => {
    const seen: string[] = [];
    server.use(
      http.get(`${API}/admin/knowledge/files`, ({ request }) => {
        const url = new URL(request.url);
        seen.push(url.search);
        const cursor = url.searchParams.get("cursor");
        return HttpResponse.json(
          cursor
            ? {
                files: [
                  {
                    key: "official/b.md",
                    size: 1,
                    lastModified: "2026-01-01T00:00:00Z",
                  },
                ],
                nextCursor: null,
                hasMore: false,
              }
            : {
                files: [
                  {
                    key: "official/a.md",
                    size: 1,
                    lastModified: "2026-01-01T00:00:00Z",
                  },
                ],
                nextCursor: "c1",
                hasMore: true,
              },
        );
      }),
    );

    const { result } = renderHookWithQuery(() =>
      useKnowledgeFiles("official/", 1),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
    expect(new URLSearchParams(seen[0]).get("prefix")).toBe("official/");
    expect(new URLSearchParams(seen[0]).get("limit")).toBe("1");

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(new URLSearchParams(seen[1]).get("cursor")).toBe("c1");
    expect(
      result.current.data?.pages.flatMap((p) => p.files.map((f) => f.key)),
    ).toEqual(["official/a.md", "official/b.md"]);
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

  it("useSyncKnowledge: 投入件数を返す", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/sync`, () =>
        HttpResponse.json({ message: "queued", queued: 338 }),
      ),
    );

    const { result } = renderHookWithQuery(() => useSyncKnowledge());

    await act(async () => {
      await result.current.mutateAsync();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.queued).toBe(338);
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
});

describe("useUploadFiles", () => {
  const item = (relativePath: string) => ({
    file: new File(["# x"], relativePath.split("/").pop() ?? relativePath),
    relativePath,
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("全件を相対パス付きで送り、進捗を件数で通知し、失敗分だけを返す", async () => {
    const upload = vi
      .spyOn(knowledgeRepository, "uploadFile")
      .mockImplementation(async (_file, filename) => {
        if (filename === "kanko/bad.md") throw new Error("boom");
        return { key: `official/${filename}`, message: "" };
      });
    const progress: number[] = [];
    const items = [item("a.md"), item("kanko/bad.md"), item("kurashi/c.md")];

    const { result } = renderHookWithQuery(() => useUploadFiles());
    let outcome: Awaited<ReturnType<typeof result.current.mutateAsync>> | null =
      null;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        items,
        onProgress: (done) => progress.push(done),
      });
    });

    expect(
      upload.mock.calls.map(([file, filename]) => [file.name, filename]),
    ).toEqual([
      ["a.md", "a.md"],
      ["bad.md", "kanko/bad.md"],
      ["c.md", "kurashi/c.md"],
    ]);
    expect(progress).toEqual([1, 2, 3]);
    expect(outcome).toEqual({
      uploaded: 2,
      failed: [{ ...items[1], error: "boom" }],
    });
  });
});

describe("useDraftCurated", () => {
  it("multipart POST して下書きを返す", async () => {
    server.use(
      http.post(`${API}/admin/knowledge/curated-draft`, () =>
        HttpResponse.json({
          key: "curated/x.md",
          content: "# x",
          readUrls: ["https://a.example/"],
          unreadable: [],
        }),
      ),
    );

    const { result } = renderHookWithQuery(() => useDraftCurated());

    await act(async () => {
      await result.current.mutateAsync({
        urls: ["https://a.example/"],
        files: [],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.key).toBe("curated/x.md");
  });
});
