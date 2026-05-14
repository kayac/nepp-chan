import { beforeEach, describe, expect, it, vi } from "vitest";

const { broadcastMediaRoutes: rawRoutes } = await import("./broadcast-media");

import { withResolvePrincipal } from "~/__tests__/helpers/test-app";

const routes = await withResolvePrincipal(rawRoutes);

const r2Bucket = {
  get: vi.fn(),
};

const mockEnv = {
  DB: {} as D1Database,
  JWT_SECRET: "test-secret-32-chars-long-enough",
  LINE_BROADCAST_BUCKET: r2Bucket,
} as unknown as CloudflareBindings;

const get = (key: string) =>
  new Request(`http://localhost/${key}`, { method: "GET" });

const buildR2Object = (
  contentType: string | undefined,
  bytes = new Uint8Array([0x89, 0x50]),
) => ({
  body: new ReadableStream({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  }),
  httpMetadata: contentType ? { contentType } : undefined,
});

describe("broadcastMediaRoutes: GET /:key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: 200 で R2 オブジェクトの中身を返し、Content-Type を引き継ぐ", async () => {
    r2Bucket.get.mockResolvedValue(buildR2Object("image/jpeg"));

    const res = await routes.request(get("img.jpg"), undefined, mockEnv);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(r2Bucket.get).toHaveBeenCalledWith("img.jpg");
  });

  it("Cache-Control が長期 immutable で返る（CDN 配信前提）", async () => {
    r2Bucket.get.mockResolvedValue(buildR2Object("image/png"));

    const res = await routes.request(get("img.png"), undefined, mockEnv);

    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("contentType が無い場合は application/octet-stream", async () => {
    r2Bucket.get.mockResolvedValue(buildR2Object(undefined));

    const res = await routes.request(get("file.bin"), undefined, mockEnv);

    expect(res.headers.get("content-type")).toBe("application/octet-stream");
  });

  it("R2 に存在しなければ 404", async () => {
    r2Bucket.get.mockResolvedValue(null);

    const res = await routes.request(get("missing.jpg"), undefined, mockEnv);

    expect(res.status).toBe(404);
  });
});
