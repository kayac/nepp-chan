import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createPersonaRepository } from "./persona-repository";

const repo = createPersonaRepository(testApiClient);

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("fetchPersonas", () => {
  it("デフォルト limit=30", async () => {
    server.use(
      http.get(`${API}/admin/persona`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("limit")).toBe("30");
        return HttpResponse.json({
          personas: [],
          total: 0,
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    await repo.fetchPersonas();
  });

  it("cursor を渡せる", async () => {
    server.use(
      http.get(`${API}/admin/persona`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("cursor")).toBe("cur-1");
        return HttpResponse.json({
          personas: [],
          total: 0,
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    await repo.fetchPersonas({ cursor: "cur-1" });
  });

  it("フィルターをカンマ区切り query で渡す", async () => {
    server.use(
      http.get(`${API}/admin/persona`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.get("from")).toBe("2030-01-01T00:00:00Z");
        expect(params.get("to")).toBe("2030-02-01T00:00:00Z");
        expect(params.get("sentiments")).toBe("negative,request");
        expect(params.get("relationships")).toBe("観光客,村人");
        expect(params.get("topic")).toBe("観光");
        return HttpResponse.json({
          personas: [],
          total: 0,
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    await repo.fetchPersonas({
      from: "2030-01-01T00:00:00Z",
      to: "2030-02-01T00:00:00Z",
      sentiments: ["negative", "request"],
      relationships: ["観光客", "村人"],
      topic: "観光",
    });
  });

  it("空配列のフィルターは query に含めない", async () => {
    server.use(
      http.get(`${API}/admin/persona`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.has("sentiments")).toBe(false);
        expect(params.has("relationships")).toBe(false);
        expect(params.has("topic")).toBe(false);
        return HttpResponse.json({
          personas: [],
          total: 0,
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    await repo.fetchPersonas({ sentiments: [], relationships: [] });
  });
});

describe("extractPersonas", () => {
  it("POST /admin/persona/extract", async () => {
    server.use(
      http.post(`${API}/admin/persona/extract`, () =>
        HttpResponse.json({ message: "done", results: [] }),
      ),
    );

    const result = await repo.extractPersonas();
    expect(result?.message).toBe("done");
  });
});

describe("deleteAllPersonas", () => {
  it("DELETE /admin/persona", async () => {
    server.use(
      http.delete(`${API}/admin/persona`, () =>
        HttpResponse.json({ message: "ok", count: 3 }),
      ),
    );

    const result = await repo.deleteAllPersonas();
    expect(result?.count).toBe(3);
  });
});

describe("失敗系", () => {
  it("fetchPersonas: 500 は throw", async () => {
    server.use(
      http.get(`${API}/admin/persona`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    await expect(repo.fetchPersonas()).rejects.toBeDefined();
  });

  it("extractPersonas: 500 は throw", async () => {
    server.use(
      http.post(`${API}/admin/persona/extract`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    await expect(repo.extractPersonas()).rejects.toBeDefined();
  });

  it("deleteAllPersonas: 500 は throw", async () => {
    server.use(
      http.delete(`${API}/admin/persona`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    await expect(repo.deleteAllPersonas()).rejects.toBeDefined();
  });
});
