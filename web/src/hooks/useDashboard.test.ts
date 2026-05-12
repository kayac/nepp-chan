import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useBroadcasts,
  useCreateBroadcast,
  useFeedbackDetail,
  useKnowledgeFile,
  useKnowledgeFiles,
  usePollResults,
  useSyncKnowledge,
  useUnifiedFiles,
} from "./useDashboard";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("条件付き enabled 系 query", () => {
  it("useKnowledgeFile: key=null なら fetchStatus は idle", () => {
    const { result } = renderHookWithQuery(() => useKnowledgeFile(null));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useFeedbackDetail: id=null なら fetchStatus は idle", () => {
    const { result } = renderHookWithQuery(() => useFeedbackDetail(null));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("usePollResults: id=null なら fetchStatus は idle", () => {
    const { result } = renderHookWithQuery(() => usePollResults(null));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useKnowledgeFile: key 指定時に fetch される", async () => {
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

describe("単純 query", () => {
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

describe("infinite query 系", () => {
  it("useBroadcasts: status filter をクエリに含む", async () => {
    let received: string | null = null;
    server.use(
      http.get(`${API}/admin/broadcast`, ({ request }) => {
        received = new URL(request.url).searchParams.get("status");
        return HttpResponse.json({ broadcasts: [], nextCursor: null });
      }),
    );

    const { result } = renderHookWithQuery(() =>
      useBroadcasts(20, { status: "draft" }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(received).toBe("draft");
  });
});

describe("mutation 系", () => {
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

  it("useCreateBroadcast: 成功後に broadcasts を invalidate", async () => {
    server.use(
      http.post(`${API}/admin/broadcast`, () =>
        HttpResponse.json(
          {
            id: "b-1",
            title: null,
            messageType: "text",
            content: "hello",
            metadata: null,
            scheduledAt: null,
            sentAt: null,
            status: "draft",
            createdAt: "x",
            updatedAt: "x",
          },
          { status: 201 },
        ),
      ),
    );

    const { result } = renderHookWithQuery(() => useCreateBroadcast());

    let returned:
      | Awaited<ReturnType<typeof result.current.mutateAsync>>
      | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        parts: [{ type: "text", text: "hello" }],
      });
    });

    expect(returned?.id).toBe("b-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
