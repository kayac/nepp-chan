import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createBroadcastRepository } from "./broadcast-repository";

const repo = createBroadcastRepository(testApiClient);

const sample = {
  id: "b-1",
  title: "x",
  body: "y",
  parts: null,
  status: "draft",
  scheduledAt: null,
  sentAt: null,
  errorMessage: null,
  createdBy: "u-1",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("broadcast-repository", () => {
  it("fetchBroadcasts: status クエリで絞れる", async () => {
    server.use(
      http.get(`${API}/admin/broadcast`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("status")).toBe("sent");
        return HttpResponse.json({
          broadcasts: [],
          total: 0,
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    await repo.fetchBroadcasts({ status: "sent" });
  });

  it("fetchBroadcastById", async () => {
    server.use(
      http.get(`${API}/admin/broadcast/b-1`, () => HttpResponse.json(sample)),
    );

    const result = await repo.fetchBroadcastById("b-1");
    expect(result?.id).toBe("b-1");
  });

  it("createBroadcast: body をそのまま POST", async () => {
    server.use(
      http.post(`${API}/admin/broadcast`, async ({ request }) => {
        const body = (await request.json()) as { parts: unknown[] };
        expect(body.parts).toHaveLength(1);
        return HttpResponse.json(sample, { status: 201 });
      }),
    );

    await repo.createBroadcast({ parts: [{ type: "text", text: "x" }] });
  });

  it("updateBroadcast: PUT", async () => {
    server.use(
      http.put(`${API}/admin/broadcast/b-1`, () => HttpResponse.json(sample)),
    );

    await repo.updateBroadcast("b-1", {
      parts: [{ type: "text", text: "y" }],
    });
  });

  it("deleteBroadcast: DELETE", async () => {
    server.use(
      http.delete(`${API}/admin/broadcast/b-1`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    await repo.deleteBroadcast("b-1");
  });

  it("sendBroadcastNow: /:id/send", async () => {
    server.use(
      http.post(`${API}/admin/broadcast/b-1/send`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    await repo.sendBroadcastNow("b-1");
  });

  it("uploadBroadcastImage: multipart で送る", async () => {
    server.use(
      http.post(`${API}/admin/broadcast/upload-image`, () =>
        HttpResponse.json({ imageR2Key: "k.jpg" }),
      ),
    );

    const file = new File(["x"], "test.jpg", { type: "image/jpeg" });
    const result = await repo.uploadBroadcastImage(file);
    expect(result?.imageR2Key).toBe("k.jpg");
  });

  it("失敗系: 5xx は throw", async () => {
    server.use(
      http.get(`${API}/admin/broadcast`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    await expect(repo.fetchBroadcasts()).rejects.toBeDefined();
  });
});
