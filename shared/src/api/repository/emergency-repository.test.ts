import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createEmergencyRepository } from "./emergency-repository";

const repo = createEmergencyRepository(testApiClient);

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("fetchEmergencies", () => {
  it("デフォルト limit=100", async () => {
    server.use(
      http.get(`${API}/admin/emergency`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("limit")).toBe("100");
        return HttpResponse.json({ emergencies: [], total: 0 });
      }),
    );

    const result = await repo.fetchEmergencies();
    expect(result?.total).toBe(0);
  });

  it("limit を渡せる", async () => {
    server.use(
      http.get(`${API}/admin/emergency`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("limit")).toBe("10");
        return HttpResponse.json({ emergencies: [], total: 0 });
      }),
    );

    await repo.fetchEmergencies(10);
  });
});
