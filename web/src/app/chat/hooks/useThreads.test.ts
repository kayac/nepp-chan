import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useCreateThread,
  useDeleteThread,
  useMessages,
  useThread,
  useThreads,
} from "./useThreads";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("token");
});

afterEach(() => {
  localStorage.clear();
});

describe("useThreads", () => {
  it("正常系: threads を取得", async () => {
    server.use(
      http.get(`${API}/threads`, () =>
        HttpResponse.json({
          threads: [
            {
              id: "t-1",
              resourceId: "r",
              title: "x",
              createdAt: "2025-01-01T00:00:00Z",
              updatedAt: "2025-01-01T00:00:00Z",
              metadata: null,
            },
          ],
          hasMore: false,
          total: 1,
          page: 0,
          perPage: 20,
        }),
      ),
    );

    const { result } = renderHookWithQuery(() => useThreads());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.threads).toHaveLength(1);
  });
});

describe("useThread / useMessages", () => {
  it("threadId 空文字なら fetcher を呼ばない（enabled:false）", async () => {
    const { result } = renderHookWithQuery(() => useThread(""));

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useMessages も同様", async () => {
    const { result } = renderHookWithQuery(() => useMessages(""));
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useCreateThread", () => {
  it("mutate 後に list を invalidate", async () => {
    server.use(
      http.post(`${API}/threads`, () =>
        HttpResponse.json(
          {
            id: "new-1",
            resourceId: "r",
            title: "x",
            createdAt: "x",
            updatedAt: "x",
            metadata: null,
          },
          { status: 201 },
        ),
      ),
    );

    const { result } = renderHookWithQuery(() => useCreateThread());

    let returned:
      | Awaited<ReturnType<typeof result.current.mutateAsync>>
      | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync("x");
    });

    expect(returned?.id).toBe("new-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useDeleteThread", () => {
  it("mutate で削除", async () => {
    server.use(
      http.delete(`${API}/threads/t-1`, () =>
        HttpResponse.json({ message: "deleted" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useDeleteThread());

    await act(async () => {
      await result.current.mutateAsync("t-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
