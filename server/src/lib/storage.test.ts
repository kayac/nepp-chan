import { beforeEach, describe, expect, it, vi } from "vitest";

const { initMock } = vi.hoisted(() => ({
  initMock: vi.fn(),
}));

vi.mock("@mastra/cloudflare-d1", () => ({
  D1Store: vi.fn().mockImplementation(function (this: object, opts: unknown) {
    Object.assign(this, opts, { init: initMock });
  }),
}));

const { D1Store } = await import("@mastra/cloudflare-d1");
const { getStorage } = await import("./storage");

beforeEach(() => {
  vi.mocked(D1Store).mockClear();
  initMock.mockReset().mockResolvedValue(undefined);
});

describe("getStorage", () => {
  it("初回呼び出しで D1Store を生成し init を呼ぶ", async () => {
    const db = { id: "d1-1" } as unknown as D1Database;
    const storage = await getStorage(db);

    expect(D1Store).toHaveBeenCalledWith({
      id: "mastra-storage",
      binding: db,
    });
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(storage).toBeDefined();
  });

  it("同じ db では結果がキャッシュされ D1Store は再生成されない", async () => {
    const db = { id: "d1-1" } as unknown as D1Database;
    const a = await getStorage(db);
    const b = await getStorage(db);

    expect(a).toBe(b);
    expect(D1Store).toHaveBeenCalledTimes(1);
  });

  it("異なる db に切り替わると D1Store を作り直す", async () => {
    const db1 = { id: "d1-1" } as unknown as D1Database;
    const db2 = { id: "d1-2" } as unknown as D1Database;
    await getStorage(db1);
    await getStorage(db2);

    expect(D1Store).toHaveBeenCalledTimes(2);
  });
});
