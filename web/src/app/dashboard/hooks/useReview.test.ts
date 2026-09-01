import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useReviewDetail,
  useReviewQueue,
  useSubmitReviewDecision,
} from "./useReview";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("useReviewQueue", () => {
  it("一覧を取得し nextCursor でページングできる", async () => {
    server.use(
      http.get(`${API}/admin/review`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("cursor")) {
          return HttpResponse.json({
            items: [{ answerRunId: "ar-2" }],
            nextCursor: null,
            hasMore: false,
          });
        }
        return HttpResponse.json({
          items: [{ answerRunId: "ar-1" }],
          nextCursor: "2026-09-01T00:00:00.000Z",
          hasMore: true,
        });
      }),
    );

    const { result } = renderHookWithQuery(() => useReviewQueue());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
  });

  it("decided=false をクエリに渡す", async () => {
    let capturedDecided: string | null = null;
    server.use(
      http.get(`${API}/admin/review`, ({ request }) => {
        capturedDecided = new URL(request.url).searchParams.get("decided");
        return HttpResponse.json({
          items: [],
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    const { result } = renderHookWithQuery(() =>
      useReviewQueue(30, { decided: false }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedDecided).toBe("false");
  });
});

describe("useReviewDetail", () => {
  it("answerRunId=null なら fetch しない", () => {
    const { result } = renderHookWithQuery(() => useReviewDetail(null));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("answerRunId 指定時に詳細を取得する", async () => {
    server.use(
      http.get(`${API}/admin/review/ar-1`, () =>
        HttpResponse.json({ answerRunId: "ar-1", runs: [] }),
      ),
    );

    const { result } = renderHookWithQuery(() => useReviewDetail("ar-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.answerRunId).toBe("ar-1");
  });
});

describe("useSubmitReviewDecision", () => {
  it("判断を POST して成功する", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(`${API}/admin/review/ar-1/decision`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          message: "ok",
          decision: {
            id: "dec-1",
            decision: "incorrect",
            comment: null,
            reviewedBy: "u-1",
            createdAt: "2026-09-01T00:00:00.000Z",
          },
        });
      }),
    );

    const { result } = renderHookWithQuery(() => useSubmitReviewDecision());
    await act(async () => {
      await result.current.mutateAsync({
        answerRunId: "ar-1",
        decision: "incorrect",
        comment: "時刻が古い",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedBody).toEqual({
      decision: "incorrect",
      comment: "時刻が古い",
    });
  });
});
