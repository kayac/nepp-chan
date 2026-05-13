import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useClosePoll,
  useCreatePoll,
  useDeletePoll,
  usePollResults,
  usePolls,
  useSendPoll,
  useUpdatePoll,
} from "./usePolls";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("usePollResults", () => {
  it("id=null なら fetchStatus は idle", () => {
    const { result } = renderHookWithQuery(() => usePollResults(null));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("id 指定時に fetch される", async () => {
    server.use(
      http.get(`${API}/admin/polls/p-1/results`, () =>
        HttpResponse.json({ pollId: "p-1", choices: [] }),
      ),
    );

    const { result } = renderHookWithQuery(() => usePollResults("p-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pollId).toBe("p-1");
  });
});

describe("usePolls", () => {
  it("status フィルタがクエリに含まれる", async () => {
    let received: string | null = null;
    server.use(
      http.get(`${API}/admin/polls`, ({ request }) => {
        received = new URL(request.url).searchParams.get("status");
        return HttpResponse.json({ polls: [], nextCursor: null });
      }),
    );

    const { result } = renderHookWithQuery(() =>
      usePolls(20, { status: "draft" }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(received).toBe("draft");
  });
});

describe("poll mutations", () => {
  it("useDeletePoll: 成功で isSuccess", async () => {
    server.use(
      http.delete(`${API}/admin/polls/p-1`, () =>
        HttpResponse.json({ message: "deleted" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useDeletePoll());

    await act(async () => {
      await result.current.mutateAsync("p-1");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useSendPoll: 成功で isSuccess", async () => {
    server.use(
      http.post(`${API}/admin/polls/p-1/send`, () =>
        HttpResponse.json({ message: "sent" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useSendPoll());

    await act(async () => {
      await result.current.mutateAsync("p-1");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useClosePoll: 成功で isSuccess", async () => {
    server.use(
      http.post(`${API}/admin/polls/p-1/close`, () =>
        HttpResponse.json({ message: "closed" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useClosePoll());

    await act(async () => {
      await result.current.mutateAsync("p-1");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useCreatePoll / useUpdatePoll: インスタンス化できる", () => {
    const create = renderHookWithQuery(() => useCreatePoll());
    expect(typeof create.result.current.mutateAsync).toBe("function");

    const update = renderHookWithQuery(() => useUpdatePoll());
    expect(typeof update.result.current.mutateAsync).toBe("function");
  });
});
