import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";

const { testDbHolder } = vi.hoisted(() => ({
  testDbHolder: { db: null as TestDb | null },
}));

vi.mock("~/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/db")>();
  return { ...actual, createDb: () => testDbHolder.db };
});

const { widgetSiteRepository } = await import("./widget-site-repository");

const fakeD1 = {} as D1Database;

const create = (over: Partial<{ id: string; host: string }> = {}) =>
  widgetSiteRepository.create(fakeD1, {
    id: over.id ?? "ws-1",
    host: over.host ?? "vill.otoineppu.hokkaido.jp",
    instructions: "行政手続きを優先して案内する",
    createdAt: "2026-08-12T00:00:00.000Z",
  });

describe("widgetSiteRepository", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
  });

  it("host で設置サイトを引ける", async () => {
    await create();

    const site = await widgetSiteRepository.findByHost(
      fakeD1,
      "vill.otoineppu.hokkaido.jp",
    );

    expect(site?.instructions).toBe("行政手続きを優先して案内する");
  });

  it("www 付き・大文字のホストでも同じ行に解決する", async () => {
    await create();

    const site = await widgetSiteRepository.findByHost(
      fakeD1,
      "WWW.Vill.Otoineppu.Hokkaido.JP",
    );

    expect(site?.host).toBe("vill.otoineppu.hokkaido.jp");
  });

  it("未登録の host は null を返す", async () => {
    await create();

    expect(
      await widgetSiteRepository.findByHost(fakeD1, "evil.example.com"),
    ).toBeNull();
  });

  it("登録時に host を正規化して保存し、作成した行を返す", async () => {
    const created = await widgetSiteRepository.create(fakeD1, {
      id: "ws-2",
      host: "  WWW.Example.COM ",
      instructions: "案内文",
      createdAt: "2026-08-12T00:00:00.000Z",
    });

    expect(created.host).toBe("example.com");
    expect(
      (await widgetSiteRepository.findByHost(fakeD1, "example.com"))?.id,
    ).toBe("ws-2");
  });

  it("id で引ける", async () => {
    await create();

    expect((await widgetSiteRepository.findById(fakeD1, "ws-1"))?.host).toBe(
      "vill.otoineppu.hokkaido.jp",
    );
    expect(await widgetSiteRepository.findById(fakeD1, "missing")).toBeNull();
  });

  it("一覧を取得できる", async () => {
    await create();
    await create({ id: "ws-2", host: "example.com" });

    expect(await widgetSiteRepository.list(fakeD1)).toHaveLength(2);
  });

  it("更新すると instructions と updatedAt が変わり、更新後の行を返す", async () => {
    await create();

    const updated = await widgetSiteRepository.update(fakeD1, "ws-1", {
      instructions: "書き換えた案内文",
    });

    expect(updated.instructions).toBe("書き換えた案内文");
    expect(updated.updatedAt).not.toBeNull();
  });

  it("更新でも host を正規化する", async () => {
    await create();

    await widgetSiteRepository.update(fakeD1, "ws-1", {
      host: "WWW.Example.COM",
    });

    expect(
      await widgetSiteRepository.findByHost(fakeD1, "example.com"),
    ).not.toBeNull();
  });

  it("削除すると引けなくなる", async () => {
    await create();

    await widgetSiteRepository.delete(fakeD1, "ws-1");

    expect(
      await widgetSiteRepository.findByHost(
        fakeD1,
        "vill.otoineppu.hokkaido.jp",
      ),
    ).toBeNull();
  });
});
