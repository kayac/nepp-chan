import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createReviewRepository } from "./review-repository";

const repo = createReviewRepository(testApiClient);

const queueResponse = { items: [], nextCursor: null, hasMore: false };

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("fetchQueue", () => {
  it("デフォルトの limit=30 で呼ぶ", async () => {
    server.use(
      http.get(`${API}/admin/review`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.get("limit")).toBe("30");
        expect(params.get("cursor")).toBeNull();
        expect(params.get("decided")).toBeNull();
        return HttpResponse.json(queueResponse);
      }),
    );

    const result = await repo.fetchQueue();
    expect(result?.hasMore).toBe(false);
  });

  it("limit / cursor を渡せる", async () => {
    server.use(
      http.get(`${API}/admin/review`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.get("limit")).toBe("10");
        expect(params.get("cursor")).toBe("cur");
        return HttpResponse.json(queueResponse);
      }),
    );

    await repo.fetchQueue({ limit: 10, cursor: "cur" });
  });

  it("decided=true は文字列 true になる", async () => {
    server.use(
      http.get(`${API}/admin/review`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("decided")).toBe("true");
        return HttpResponse.json(queueResponse);
      }),
    );

    await repo.fetchQueue({ decided: true });
  });

  it("decided=false は文字列 false になる", async () => {
    server.use(
      http.get(`${API}/admin/review`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("decided")).toBe("false");
        return HttpResponse.json(queueResponse);
      }),
    );

    await repo.fetchQueue({ decided: false });
  });

  it("5xx は throw する", async () => {
    server.use(
      http.get(`${API}/admin/review`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );

    await expect(repo.fetchQueue()).rejects.toBeDefined();
  });
});

describe("fetchDetail", () => {
  it("path に answerRunId を埋め込む", async () => {
    server.use(
      http.get(`${API}/admin/review/run-1`, () =>
        HttpResponse.json({ answerRunId: "run-1" }),
      ),
    );

    const result = await repo.fetchDetail("run-1");
    expect(result?.answerRunId).toBe("run-1");
  });

  it("404 は throw する", async () => {
    server.use(
      http.get(`${API}/admin/review/missing`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 404 }),
      ),
    );

    await expect(repo.fetchDetail("missing")).rejects.toBeDefined();
  });
});

describe("submitDecision", () => {
  it("answerRunId は path、残りは body に送る", async () => {
    server.use(
      http.post(`${API}/admin/review/run-1/decision`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toEqual({ decision: "incorrect", comment: "誤り" });
        return HttpResponse.json({ message: "ok" });
      }),
    );

    const result = await repo.submitDecision({
      answerRunId: "run-1",
      decision: "incorrect",
      comment: "誤り",
    });
    expect(result?.message).toBe("ok");
  });

  it("5xx は throw する", async () => {
    server.use(
      http.post(`${API}/admin/review/run-1/decision`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );

    await expect(
      repo.submitDecision({ answerRunId: "run-1", decision: "no_issue" }),
    ).rejects.toBeDefined();
  });
});

describe("undoDecision", () => {
  it("DELETE で判断を取り消す", async () => {
    server.use(
      http.delete(`${API}/admin/review/run-1/decision`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    const result = await repo.undoDecision("run-1");
    expect(result?.message).toBe("ok");
  });

  it("5xx は throw する", async () => {
    server.use(
      http.delete(`${API}/admin/review/run-1/decision`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );

    await expect(repo.undoDecision("run-1")).rejects.toBeDefined();
  });
});
