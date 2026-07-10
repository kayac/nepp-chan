import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./test/msw-server";
import { createThread } from "./thread";

const API_URL = "http://localhost:8787";

const threadResponse = {
  id: "thread-1",
  resourceId: "widget-abc",
  title: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  metadata: null,
};

describe("createThread", () => {
  it("POST /threads を Authorization 付きで叩き thread id を返す", async () => {
    let authHeader: string | null = null;
    server.use(
      http.post(`${API_URL}/threads`, async ({ request }) => {
        authHeader = request.headers.get("Authorization");
        return HttpResponse.json(threadResponse, { status: 201 });
      }),
    );

    const threadId = await createThread(API_URL, "token-1");

    expect(threadId).toBe("thread-1");
    expect(authHeader).toBe("Bearer token-1");
  });

  it("レスポンスが失敗ステータスなら throw する", async () => {
    server.use(
      http.post(
        `${API_URL}/threads`,
        () => new HttpResponse("boom", { status: 500 }),
      ),
    );

    await expect(createThread(API_URL, "token-1")).rejects.toThrow();
  });
});
