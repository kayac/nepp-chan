import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useDeleteFeedbacks,
  useFeedbackDetail,
  useFeedbacks,
  useResolveFeedback,
  useUnresolveFeedback,
} from "./useFeedback";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("useFeedbackDetail", () => {
  it("id=null なら fetchStatus は idle", () => {
    const { result } = renderHookWithQuery(() => useFeedbackDetail(null));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("id 指定時に fetch", async () => {
    server.use(
      http.get(`${API}/admin/feedback/f-1`, () =>
        HttpResponse.json({ id: "f-1", rating: "good" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useFeedbackDetail("f-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("f-1");
  });
});

describe("useFeedbacks", () => {
  it("rating フィルタがクエリに含まれる", async () => {
    let received: string | null = null;
    server.use(
      http.get(`${API}/admin/feedback`, ({ request }) => {
        received = new URL(request.url).searchParams.get("rating");
        return HttpResponse.json({ feedbacks: [], nextCursor: null });
      }),
    );

    const { result } = renderHookWithQuery(() =>
      useFeedbacks(20, { rating: "bad" }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(received).toBe("bad");
  });
});

describe("feedback mutations", () => {
  it("useResolveFeedback: 成功で isSuccess", async () => {
    server.use(
      http.put(`${API}/admin/feedback/f-1/resolve`, () =>
        HttpResponse.json({ message: "resolved" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useResolveFeedback());

    await act(async () => {
      await result.current.mutateAsync("f-1");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useUnresolveFeedback: 成功で isSuccess", async () => {
    server.use(
      http.delete(`${API}/admin/feedback/f-1/resolve`, () =>
        HttpResponse.json({ message: "unresolved" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useUnresolveFeedback());

    await act(async () => {
      await result.current.mutateAsync("f-1");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useDeleteFeedbacks: 成功で isSuccess", async () => {
    server.use(
      http.delete(`${API}/admin/feedback`, () =>
        HttpResponse.json({ message: "deleted" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useDeleteFeedbacks());

    await act(async () => {
      await result.current.mutateAsync();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
