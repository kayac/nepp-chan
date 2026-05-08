import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "../lib/auth-token";
import { server } from "../test/msw-server";
import {
  deleteAllPersonas,
  extractPersonas,
  fetchPersonas,
} from "./persona-repository";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
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

    await fetchPersonas();
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

    await fetchPersonas({ cursor: "cur-1" });
  });
});

describe("extractPersonas", () => {
  it("POST /admin/persona/extract", async () => {
    server.use(
      http.post(`${API}/admin/persona/extract`, () =>
        HttpResponse.json({ message: "done", results: [] }),
      ),
    );

    const result = await extractPersonas();
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

    const result = await deleteAllPersonas();
    expect(result?.count).toBe(3);
  });
});
