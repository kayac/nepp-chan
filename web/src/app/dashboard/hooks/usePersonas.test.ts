import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  PERSONA_PAGE_SIZE,
  usePersonas,
  usePersonaTopics,
} from "./usePersonas";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("usePersonas", () => {
  it("絞り込みとページサイズをクエリパラメータで送る", async () => {
    let params: URLSearchParams | null = null;
    server.use(
      http.get(`${API}/admin/persona`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({
          personas: [],
          total: 0,
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    const { result } = renderHookWithQuery(() =>
      usePersonas({
        from: "2026-07-01",
        sentiments: ["negative", "request"],
        topic: "生活",
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(params!.get("limit")).toBe(String(PERSONA_PAGE_SIZE));
    expect(params!.get("from")).toBe("2026-07-01");
    expect(params!.get("sentiments")).toBe("negative,request");
    expect(params!.get("topic")).toBe("生活");
  });

  it("空の絞り込みは query に含めない", async () => {
    let params: URLSearchParams | null = null;
    server.use(
      http.get(`${API}/admin/persona`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({
          personas: [],
          total: 0,
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    const { result } = renderHookWithQuery(() => usePersonas({}));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(params!.has("sentiments")).toBe(false);
    expect(params!.has("topic")).toBe(false);
    expect(params!.has("from")).toBe(false);
  });

  it("nextCursor を辿って次ページを読める", async () => {
    server.use(
      http.get(`${API}/admin/persona`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        return HttpResponse.json({
          personas: [{ id: cursor ? "p-2" : "p-1" }],
          total: 2,
          nextCursor: cursor ? null : "cur-1",
          hasMore: !cursor,
        });
      }),
    );

    const { result } = renderHookWithQuery(() => usePersonas({}));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(
      result.current.data?.pages.flatMap((p) => p.personas).map((p) => p.id),
    ).toEqual(["p-1", "p-2"]);
  });

  it("enabled: false なら取得しない", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/admin/persona`, () => {
        calls += 1;
        return HttpResponse.json({
          personas: [],
          total: 0,
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    renderHookWithQuery(() => usePersonas({}, { enabled: false }));

    await waitFor(() => expect(calls).toBe(0));
  });
});

describe("usePersonaTopics", () => {
  it("集計結果を返し、絞り込みを引き渡す", async () => {
    let params: URLSearchParams | null = null;
    server.use(
      http.get(`${API}/admin/persona/topics`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({
          topics: [
            {
              topic: "生活",
              total: 4,
              sentiments: {
                positive: 0,
                negative: 3,
                request: 1,
                neutral: 0,
              },
              sample: "粗大ごみの出し方がわかりにくい",
            },
          ],
        });
      }),
    );

    const { result } = renderHookWithQuery(() =>
      usePersonaTopics({ sentiments: ["negative"] }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.topics[0]).toMatchObject({
      topic: "生活",
      total: 4,
    });
    expect(params!.get("sentiments")).toBe("negative");
  });

  it("enabled: false なら取得しない", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/admin/persona/topics`, () => {
        calls += 1;
        return HttpResponse.json({ topics: [] });
      }),
    );

    renderHookWithQuery(() => usePersonaTopics({}, { enabled: false }));

    await waitFor(() => expect(calls).toBe(0));
  });
});
