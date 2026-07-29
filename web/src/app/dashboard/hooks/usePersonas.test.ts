import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useDeletePersonas,
  useExtractPersonas,
  usePersonas,
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
  it("nextCursor を辿って fetchNextPage できる", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/admin/persona`, ({ request }) => {
        calls += 1;
        const cursor = new URL(request.url).searchParams.get("cursor");
        if (cursor) {
          return HttpResponse.json({
            personas: [{ id: "p-2" }],
            nextCursor: null,
          });
        }
        return HttpResponse.json({
          personas: [{ id: "p-1" }],
          nextCursor: "cursor-1",
        });
      }),
    );

    const { result } = renderHookWithQuery(() => usePersonas(10));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it("limit クエリパラメータを送る", async () => {
    let received: string | null = null;
    server.use(
      http.get(`${API}/admin/persona`, ({ request }) => {
        received = new URL(request.url).searchParams.get("limit");
        return HttpResponse.json({ personas: [], nextCursor: null });
      }),
    );

    const { result } = renderHookWithQuery(() => usePersonas(5));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(received).toBe("5");
  });

  it("フィルターをクエリパラメータで送る", async () => {
    let params: URLSearchParams | null = null;
    server.use(
      http.get(`${API}/admin/persona`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({ personas: [], nextCursor: null });
      }),
    );

    const { result } = renderHookWithQuery(() =>
      usePersonas(30, {
        from: "2026-07-01",
        sentiments: ["negative"],
        relationships: ["観光客"],
        topic: "観光",
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(params!.get("from")).toBe("2026-07-01");
    expect(params!.get("sentiments")).toBe("negative");
    expect(params!.get("relationships")).toBe("観光客");
    expect(params!.get("topic")).toBe("観光");
  });
});

describe("useExtractPersonas", () => {
  it("mutate 成功で isSuccess", async () => {
    server.use(
      http.post(`${API}/admin/persona/extract`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useExtractPersonas());

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useDeletePersonas", () => {
  it("mutate 成功で isSuccess", async () => {
    server.use(
      http.delete(`${API}/admin/persona`, () =>
        HttpResponse.json({ message: "deleted" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useDeletePersonas());

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
