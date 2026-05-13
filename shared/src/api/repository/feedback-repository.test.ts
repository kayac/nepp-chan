import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createFeedbackRepository } from "./feedback-repository";

const repo = createFeedbackRepository(testApiClient);

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

const validFeedback = {
  threadId: "t-1",
  messageId: "m-1",
  rating: "good" as const,
  conversationContext: {
    targetMessage: { id: "m-1", role: "assistant", content: "x" },
    previousMessages: [],
    nextMessages: [],
  },
};

describe("submitFeedback", () => {
  it("body をそのまま POST する", async () => {
    server.use(
      http.post(`${API}/feedback`, async ({ request }) => {
        const body = (await request.json()) as { rating: string };
        expect(body.rating).toBe("good");
        return HttpResponse.json({ id: "fb-1" }, { status: 201 });
      }),
    );

    const result = await repo.submitFeedback(validFeedback);
    expect(result?.id).toBe("fb-1");
  });
});

describe("fetchFeedbacks", () => {
  it("デフォルトの limit=30 で呼ぶ", async () => {
    server.use(
      http.get(`${API}/admin/feedback`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("limit")).toBe("30");
        return HttpResponse.json({
          feedbacks: [],
          total: 0,
          nextCursor: null,
          hasMore: false,
          stats: { total: 0, good: 0, bad: 0, idea: 0, byCategory: {} },
        });
      }),
    );

    await repo.fetchFeedbacks();
  });

  it("rating / cursor を渡せる", async () => {
    server.use(
      http.get(`${API}/admin/feedback`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.get("rating")).toBe("bad");
        expect(params.get("cursor")).toBe("cur");
        return HttpResponse.json({
          feedbacks: [],
          total: 0,
          nextCursor: null,
          hasMore: false,
          stats: { total: 0, good: 0, bad: 0, idea: 0, byCategory: {} },
        });
      }),
    );

    await repo.fetchFeedbacks({ rating: "bad", cursor: "cur" });
  });
});

describe("fetchFeedbackById", () => {
  it("path に id を埋め込む", async () => {
    server.use(
      http.get(`${API}/admin/feedback/fb-1`, () =>
        HttpResponse.json({
          id: "fb-1",
          threadId: "t",
          messageId: "m",
          rating: "good",
          category: null,
          comment: null,
          conversationContext: {
            targetMessage: { id: "m", role: "assistant", content: "x" },
            previousMessages: [],
            nextMessages: [],
          },
          toolExecutions: null,
          createdAt: "2025-01-01T00:00:00Z",
          resolvedAt: null,
        }),
      ),
    );

    const result = await repo.fetchFeedbackById("fb-1");
    expect(result?.id).toBe("fb-1");
  });

  it("404 は throw", async () => {
    server.use(
      http.get(`${API}/admin/feedback/missing`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 404 }),
      ),
    );

    await expect(repo.fetchFeedbackById("missing")).rejects.toBeDefined();
  });
});

describe("submitFeedback error", () => {
  it("5xx は throw する", async () => {
    server.use(
      http.post(`${API}/feedback`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );
    await expect(repo.submitFeedback(validFeedback)).rejects.toBeDefined();
  });
});

describe("fetchFeedbacks error", () => {
  it("5xx は throw する", async () => {
    server.use(
      http.get(`${API}/admin/feedback`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );
    await expect(repo.fetchFeedbacks()).rejects.toBeDefined();
  });
});

describe("resolveFeedback / unresolveFeedback / deleteAllFeedbacks", () => {
  it("resolve は PUT", async () => {
    server.use(
      http.put(`${API}/admin/feedback/fb-1/resolve`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    const result = await repo.resolveFeedback("fb-1");
    expect(result?.message).toBe("ok");
  });

  it("unresolve は DELETE", async () => {
    server.use(
      http.delete(`${API}/admin/feedback/fb-1/resolve`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    const result = await repo.unresolveFeedback("fb-1");
    expect(result?.message).toBe("ok");
  });

  it("deleteAll は DELETE /admin/feedback", async () => {
    server.use(
      http.delete(`${API}/admin/feedback`, () =>
        HttpResponse.json({ message: "5件削除", count: 5 }),
      ),
    );

    const result = await repo.deleteAllFeedbacks();
    expect(result?.count).toBe(5);
  });

  it("resolveFeedback の error 経路", async () => {
    server.use(
      http.put(`${API}/admin/feedback/x/resolve`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );
    await expect(repo.resolveFeedback("x")).rejects.toBeDefined();
  });

  it("unresolveFeedback の error 経路", async () => {
    server.use(
      http.delete(`${API}/admin/feedback/x/resolve`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );
    await expect(repo.unresolveFeedback("x")).rejects.toBeDefined();
  });

  it("deleteAllFeedbacks の error 経路", async () => {
    server.use(
      http.delete(`${API}/admin/feedback`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );
    await expect(repo.deleteAllFeedbacks()).rejects.toBeDefined();
  });
});
