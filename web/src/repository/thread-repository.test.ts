import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "../lib/auth-token";
import { server } from "../test/msw-server";
import {
  createThread,
  deleteThread,
  fetchMessages,
  fetchThread,
  fetchThreads,
} from "./thread-repository";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("test-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("fetchThreads", () => {
  it("正常系: ページとサイズをクエリで送る", async () => {
    server.use(
      http.get("http://localhost:8787/threads", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("page")).toBe("2");
        expect(url.searchParams.get("perPage")).toBe("10");
        return HttpResponse.json({
          threads: [],
          hasMore: false,
          total: 0,
          page: 2,
          perPage: 10,
        });
      }),
    );

    const result = await fetchThreads(2, 10);
    expect(result?.page).toBe(2);
  });

  it("デフォルトは page=0 / perPage=20", async () => {
    server.use(
      http.get("http://localhost:8787/threads", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("page")).toBe("0");
        expect(url.searchParams.get("perPage")).toBe("20");
        return HttpResponse.json({
          threads: [],
          hasMore: false,
          total: 0,
          page: 0,
          perPage: 20,
        });
      }),
    );

    await fetchThreads();
  });

  it("Authorization ヘッダに Bearer token を付ける", async () => {
    let receivedAuth: string | null = null;
    server.use(
      http.get("http://localhost:8787/threads", ({ request }) => {
        receivedAuth = request.headers.get("authorization");
        return HttpResponse.json({
          threads: [],
          hasMore: false,
          total: 0,
          page: 0,
          perPage: 20,
        });
      }),
    );

    await fetchThreads();
    expect(receivedAuth).toBe("Bearer test-token");
  });

  it("500 エラーは throw", async () => {
    server.use(
      http.get("http://localhost:8787/threads", () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    await expect(fetchThreads()).rejects.toBeDefined();
  });
});

describe("createThread", () => {
  it("title を渡せる", async () => {
    server.use(
      http.post("http://localhost:8787/threads", async ({ request }) => {
        const body = (await request.json()) as { title?: string };
        expect(body.title).toBe("新スレッド");
        return HttpResponse.json(
          {
            id: "t-1",
            resourceId: "r",
            title: "新スレッド",
            createdAt: "x",
            updatedAt: "x",
            metadata: null,
          },
          { status: 201 },
        );
      }),
    );

    const result = await createThread("新スレッド");
    expect(result?.id).toBe("t-1");
  });

  it("title 省略可", async () => {
    server.use(
      http.post("http://localhost:8787/threads", async ({ request }) => {
        const body = (await request.json()) as { title?: string };
        expect(body.title).toBeUndefined();
        return HttpResponse.json(
          {
            id: "t-2",
            resourceId: "r",
            title: null,
            createdAt: "x",
            updatedAt: "x",
            metadata: null,
          },
          { status: 201 },
        );
      }),
    );

    const result = await createThread();
    expect(result?.id).toBe("t-2");
  });
});

describe("fetchThread", () => {
  it("path に threadId を埋め込む", async () => {
    server.use(
      http.get("http://localhost:8787/threads/abc", () =>
        HttpResponse.json({
          id: "abc",
          resourceId: "r",
          title: "x",
          createdAt: "x",
          updatedAt: "x",
          metadata: null,
        }),
      ),
    );

    const result = await fetchThread("abc");
    expect(result?.id).toBe("abc");
  });

  it("404 は throw", async () => {
    server.use(
      http.get("http://localhost:8787/threads/missing", () =>
        HttpResponse.json({ error: { message: "not found" } }, { status: 404 }),
      ),
    );

    await expect(fetchThread("missing")).rejects.toBeDefined();
  });
});

describe("fetchMessages", () => {
  it("messages 配列を返す", async () => {
    server.use(
      http.get("http://localhost:8787/threads/t-1/messages", () =>
        HttpResponse.json({
          messages: [{ id: "m-1", role: "user", parts: [] }],
        }),
      ),
    );

    const result = await fetchMessages("t-1");
    expect(result?.messages).toHaveLength(1);
  });
});

describe("deleteThread", () => {
  it("正常系", async () => {
    server.use(
      http.delete("http://localhost:8787/threads/t-1", () =>
        HttpResponse.json({ message: "deleted" }),
      ),
    );

    const result = await deleteThread("t-1");
    expect(result?.message).toBe("deleted");
  });
});
