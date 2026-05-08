import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "../test-helpers/test-db";

const { testDbHolder } = vi.hoisted(() => ({
  testDbHolder: { db: null as TestDb | null },
}));

vi.mock("~/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/db")>();
  return {
    ...actual,
    createDb: () => testDbHolder.db,
  };
});

const { broadcastMessages } = await import("~/db");
const { broadcastRepository } = await import("./broadcast-repository");

const fakeD1 = {} as D1Database;

const baseInput = {
  id: "b-1",
  title: "雪のお知らせ",
  body: "今夜は雪です",
  parts: JSON.stringify([{ type: "text", text: "今夜は雪です" }]),
  status: "draft",
  createdBy: "u-1",
  createdAt: "2025-01-01T00:00:00Z",
};

describe("broadcastRepository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  describe("create", () => {
    it("挿入して id を返す", async () => {
      const id = await broadcastRepository.create(fakeD1, baseInput);

      expect(id).toBe("b-1");
      const saved = await db.select().from(broadcastMessages).get();
      expect(saved).toMatchObject({
        id: "b-1",
        title: "雪のお知らせ",
        status: "draft",
      });
    });

    it("scheduledAt 未指定時は null になる", async () => {
      await broadcastRepository.create(fakeD1, baseInput);

      const saved = await db.select().from(broadcastMessages).get();
      expect(saved?.scheduledAt).toBeNull();
    });
  });

  describe("update", () => {
    it("一部フィールドのみ更新できる（残りは保持）", async () => {
      await broadcastRepository.create(fakeD1, baseInput);

      await broadcastRepository.update(fakeD1, "b-1", {
        title: "更新後タイトル",
      });

      const saved = await db.select().from(broadcastMessages).get();
      expect(saved?.title).toBe("更新後タイトル");
      expect(saved?.body).toBe("今夜は雪です");
      expect(saved?.updatedAt).not.toBeNull();
    });

    it("status の遷移が反映される", async () => {
      await broadcastRepository.create(fakeD1, baseInput);

      await broadcastRepository.update(fakeD1, "b-1", { status: "scheduled" });

      const saved = await db.select().from(broadcastMessages).get();
      expect(saved?.status).toBe("scheduled");
    });
  });

  describe("findById", () => {
    it("存在する id は行を返す", async () => {
      await broadcastRepository.create(fakeD1, baseInput);

      const result = await broadcastRepository.findById(fakeD1, "b-1");

      expect(result?.title).toBe("雪のお知らせ");
    });

    it("存在しない id は null", async () => {
      const result = await broadcastRepository.findById(fakeD1, "missing");
      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    const seed = async (count: number) => {
      for (let i = 0; i < count; i += 1) {
        await broadcastRepository.create(fakeD1, {
          ...baseInput,
          id: `b-${i.toString().padStart(2, "0")}`,
          createdAt: new Date(Date.UTC(2025, 0, 1, 0, 0, i)).toISOString(),
        });
      }
    };

    it("createdAt 降順で取得する", async () => {
      await seed(3);

      const { broadcasts, hasMore, nextCursor } =
        await broadcastRepository.findAll(fakeD1);

      expect(broadcasts.map((b) => b.id)).toEqual(["b-02", "b-01", "b-00"]);
      expect(hasMore).toBe(false);
      expect(nextCursor).toBeNull();
    });

    it("limit を超えるレコードがあれば hasMore=true", async () => {
      await seed(5);

      const result = await broadcastRepository.findAll(fakeD1, { limit: 2 });

      expect(result.broadcasts).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe(result.broadcasts[1].createdAt);
    });

    it("status filter で絞れる", async () => {
      await broadcastRepository.create(fakeD1, baseInput);
      await broadcastRepository.create(fakeD1, {
        ...baseInput,
        id: "b-2",
        status: "sent",
      });

      const result = await broadcastRepository.findAll(fakeD1, {
        status: "sent",
      });

      expect(result.broadcasts).toHaveLength(1);
      expect(result.broadcasts[0].id).toBe("b-2");
    });

    it("cursor で続きを取得できる", async () => {
      await seed(4);

      const first = await broadcastRepository.findAll(fakeD1, { limit: 2 });
      const second = await broadcastRepository.findAll(fakeD1, {
        limit: 2,
        cursor: first.nextCursor!,
      });

      expect(first.broadcasts.map((b) => b.id)).toEqual(["b-03", "b-02"]);
      expect(second.broadcasts.map((b) => b.id)).toEqual(["b-01", "b-00"]);
    });
  });

  describe("findScheduledReady", () => {
    it("scheduled かつ scheduledAt <= now のものだけ返す", async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      const future = new Date(Date.now() + 60_000).toISOString();

      await db.insert(broadcastMessages).values([
        { ...baseInput, id: "ready", status: "scheduled", scheduledAt: past },
        {
          ...baseInput,
          id: "future",
          status: "scheduled",
          scheduledAt: future,
        },
        { ...baseInput, id: "draft", status: "draft" },
      ]);

      const result = await broadcastRepository.findScheduledReady(fakeD1);

      expect(result.map((r) => r.id)).toEqual(["ready"]);
    });
  });

  describe("markSent / markFailed", () => {
    it("markSent で status=sent + sentAt が設定される", async () => {
      await broadcastRepository.create(fakeD1, baseInput);

      await broadcastRepository.markSent(fakeD1, "b-1");

      const saved = await db.select().from(broadcastMessages).get();
      expect(saved?.status).toBe("sent");
      expect(saved?.sentAt).not.toBeNull();
    });

    it("markFailed で errorMessage と status=failed が記録される", async () => {
      await broadcastRepository.create(fakeD1, baseInput);

      await broadcastRepository.markFailed(fakeD1, "b-1", "API timeout");

      const saved = await db.select().from(broadcastMessages).get();
      expect(saved?.status).toBe("failed");
      expect(saved?.errorMessage).toBe("API timeout");
    });
  });

  describe("delete", () => {
    it("対象 id のみ削除", async () => {
      await broadcastRepository.create(fakeD1, baseInput);
      await broadcastRepository.create(fakeD1, { ...baseInput, id: "b-2" });

      await broadcastRepository.delete(fakeD1, "b-1");

      const remaining = await db.select().from(broadcastMessages);
      expect(remaining.map((r) => r.id)).toEqual(["b-2"]);
    });
  });

  describe("count", () => {
    it("status を指定しないと全件カウント", async () => {
      await broadcastRepository.create(fakeD1, baseInput);
      await broadcastRepository.create(fakeD1, { ...baseInput, id: "b-2" });

      expect(await broadcastRepository.count(fakeD1)).toBe(2);
    });

    it("status 指定でフィルタカウント", async () => {
      await broadcastRepository.create(fakeD1, baseInput);
      await broadcastRepository.create(fakeD1, {
        ...baseInput,
        id: "b-2",
        status: "sent",
      });

      expect(await broadcastRepository.count(fakeD1, "sent")).toBe(1);
    });
  });

  describe("findByKeyword", () => {
    it("title または body の部分一致で検索（sent のみ）", async () => {
      await db.insert(broadcastMessages).values([
        {
          ...baseInput,
          id: "b-1",
          title: "雪情報",
          body: "今夜は雪",
          status: "sent",
          sentAt: "2025-01-01T00:00:00Z",
        },
        {
          ...baseInput,
          id: "b-2",
          title: "イベント",
          body: "雪まつり開催",
          status: "sent",
          sentAt: "2025-01-02T00:00:00Z",
        },
        {
          ...baseInput,
          id: "b-3",
          title: "雪",
          body: "x",
          status: "draft", // sent でないので対象外
        },
      ]);

      const result = await broadcastRepository.findByKeyword(fakeD1, "雪");

      expect(result.map((r) => r.id).sort()).toEqual(["b-1", "b-2"]);
    });
  });
});
