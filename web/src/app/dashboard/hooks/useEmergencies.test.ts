import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import { useEmergencies } from "./useEmergencies";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("useEmergencies", () => {
  it("正常系: emergencies を取得", async () => {
    server.use(
      http.get(`${API}/admin/emergency`, () =>
        HttpResponse.json({ emergencies: [{ id: "e-1", type: "fire" }] }),
      ),
    );

    const { result } = renderHookWithQuery(() => useEmergencies());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.emergencies).toHaveLength(1);
  });

  it("limit クエリパラメータを送る", async () => {
    let received: string | null = null;
    server.use(
      http.get(`${API}/admin/emergency`, ({ request }) => {
        received = new URL(request.url).searchParams.get("limit");
        return HttpResponse.json({ emergencies: [] });
      }),
    );

    const { result } = renderHookWithQuery(() => useEmergencies());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(received).toBe("100");
  });

  it("enabled: false なら取得しない", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/admin/emergency`, () => {
        calls += 1;
        return HttpResponse.json({ emergencies: [] });
      }),
    );

    renderHookWithQuery(() => useEmergencies({ enabled: false }));

    await waitFor(() => expect(calls).toBe(0));
  });

  it("5xx エラー時に isError=true", async () => {
    server.use(
      http.get(`${API}/admin/emergency`, () =>
        HttpResponse.json({ error: "internal" }, { status: 500 }),
      ),
    );

    const { result } = renderHookWithQuery(() => useEmergencies());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
