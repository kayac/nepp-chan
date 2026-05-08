import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "../lib/auth-token";
import { server } from "../test/msw-server";
import { fetchEmergencies } from "./emergency-repository";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("fetchEmergencies", () => {
  it("デフォルト limit=100", async () => {
    server.use(
      http.get(`${API}/admin/emergency`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("limit")).toBe("100");
        return HttpResponse.json({ emergencies: [], total: 0 });
      }),
    );

    const result = await fetchEmergencies();
    expect(result?.total).toBe(0);
  });

  it("limit を渡せる", async () => {
    server.use(
      http.get(`${API}/admin/emergency`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("limit")).toBe("10");
        return HttpResponse.json({ emergencies: [], total: 0 });
      }),
    );

    await fetchEmergencies(10);
  });
});
