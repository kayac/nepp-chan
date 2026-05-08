import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createThreadRepository } from "./thread-repository";

const repo = createThreadRepository(testApiClient);

beforeEach(() => {
  setTestAuthToken("test-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("fetchThreads", () => {
  it("正常系: ページとサイズをクエリで送る", async () => {
    server.use(
      http.get(`${API}/threads`, ({ request }) => {
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

    const result = await repo.fetchThreads(2, 10);
    expect(result?.page).toBe(2);
  });

  it("デフォルトは page=0 / perPage=20", async () => {
    server.use(
      http.get(`${API}/threads`, ({ request }) => {
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

    await repo.fetchThreads();
  });

  it("Authorization ヘッダに Bearer token を付ける", async () => {
    let receivedAuth: string | null = null;
    server.use(
      http.get(`${API}/threads`, ({ request }) => {
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

    await repo.fetchThreads();
    expect(receivedAuth).toBe("Bearer test-token");
  });

  it("500 エラーは throw", async () => {
    server.use(
      http.get(`${API}/threads`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    await expect(repo.fetchThreads()).rejects.toBeDefined();
  });
});

describe("createThread", () => {
  it("title を渡せる", async () => {
    server.use(
      http.post(`${API}/threads`, async ({ request }) => {
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

    const result = await repo.createThread("新スレッド");
    expect(result?.id).toBe("t-1");
  });

  it("title 省略可", async () => {
    server.use(
      http.post(`${API}/threads`, async ({ request }) => {
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

    const result = await repo.createThread();
    expect(result?.id).toBe("t-2");
  });
});

describe("fetchThread", () => {
  it("path に threadId を埋め込む", async () => {
    server.use(
      http.get(`${API}/threads/abc`, () =>
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

    const result = await repo.fetchThread("abc");
    expect(result?.id).toBe("abc");
  });

  it("404 は throw", async () => {
    server.use(
      http.get(`${API}/threads/missing`, () =>
        HttpResponse.json({ error: { message: "not found" } }, { status: 404 }),
      ),
    );

    await expect(repo.fetchThread("missing")).rejects.toBeDefined();
  });
});

describe("fetchMessages", () => {
  it("messages 配列を返す", async () => {
    server.use(
      http.get(`${API}/threads/t-1/messages`, () =>
        HttpResponse.json({
          messages: [{ id: "m-1", role: "user", parts: [] }],
        }),
      ),
    );

    const result = await repo.fetchMessages("t-1");
    expect(result?.messages).toHaveLength(1);
  });
});

describe("deleteThread", () => {
  it("正常系", async () => {
    server.use(
      http.delete(`${API}/threads/t-1`, () =>
        HttpResponse.json({ message: "deleted" }),
      ),
    );

    const result = await repo.deleteThread("t-1");
    expect(result?.message).toBe("deleted");
  });
});
