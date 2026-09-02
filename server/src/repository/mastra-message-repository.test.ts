import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { llmUsage, mastraMessages, mastraThreads } from "~/db";

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

const { mastraMessageRepository } = await import("./mastra-message-repository");

const d1 = {} as D1Database;

const period = {
  from: "2026-06-01T00:00:00.000Z",
  to: "2026-06-08T00:00:00.000Z",
};

let seq = 0;

const insertMessage = async (
  db: TestDb,
  params: { threadId: string; role?: string; createdAt: string },
) => {
  await db.insert(mastraMessages).values({
    id: `m-${++seq}`,
    threadId: params.threadId,
    role: params.role ?? "user",
    createdAt: params.createdAt,
  });
};

const insertThread = async (db: TestDb, id: string, resourceId: string) => {
  await db
    .insert(mastraThreads)
    .values({ id, resourceId, createdAt: "2026-06-01T00:00:00.000Z" });
};

describe("mastraMessageRepository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  describe("countUserMessagesByHour", () => {
    it("JST の時刻で集計する", async () => {
      await insertMessage(db, {
        threadId: "t-1",
        createdAt: "2026-06-02T00:30:00.000Z",
      });

      const rows = await mastraMessageRepository.countUserMessagesByHour(
        d1,
        period,
      );

      expect(rows).toEqual([{ hour: 9, count: 1 }]);
    });

    it("assistant のメッセージは数えない", async () => {
      await insertMessage(db, {
        threadId: "t-1",
        role: "assistant",
        createdAt: "2026-06-02T00:30:00.000Z",
      });

      const rows = await mastraMessageRepository.countUserMessagesByHour(
        d1,
        period,
      );

      expect(rows).toEqual([]);
    });
  });

  describe("countUserMessagesByWeekday", () => {
    it("JST の曜日で集計する", async () => {
      await insertMessage(db, {
        threadId: "t-1",
        createdAt: "2026-06-06T15:30:00.000Z",
      });

      const rows = await mastraMessageRepository.countUserMessagesByWeekday(
        d1,
        period,
      );

      expect(rows).toEqual([{ dow: 0, count: 1 }]);
    });
  });

  describe("countUserMessagesByDate", () => {
    it("日付ごとにスレッド数とメッセージ数を返す", async () => {
      await insertMessage(db, {
        threadId: "t-1",
        createdAt: "2026-06-02T00:00:00.000Z",
      });
      await insertMessage(db, {
        threadId: "t-1",
        createdAt: "2026-06-02T01:00:00.000Z",
      });
      await insertMessage(db, {
        threadId: "t-2",
        createdAt: "2026-06-02T02:00:00.000Z",
      });

      const rows = await mastraMessageRepository.countUserMessagesByDate(
        d1,
        period,
      );

      expect(rows).toEqual([
        { date: "2026-06-02", conversations: 2, messages: 3 },
      ]);
    });
  });

  describe("countUserMessagesByPlatform", () => {
    it("スレッドの resourceId から流入元を判定する", async () => {
      await insertThread(db, "t-line", "line:abc");
      await insertThread(db, "t-admin", "admin:abc");
      await insertThread(db, "t-widget", "widget-abc");
      await insertThread(db, "t-web", "uuid-abc");
      for (const threadId of ["t-line", "t-admin", "t-widget", "t-web"]) {
        await insertMessage(db, {
          threadId,
          createdAt: "2026-06-02T00:00:00.000Z",
        });
      }

      const rows = await mastraMessageRepository.countUserMessagesByPlatform(
        d1,
        period,
      );

      expect(
        Object.fromEntries(rows.map((r) => [r.platform, r.count])),
      ).toEqual({ line: 1, admin: 1, widget: 1, web: 1 });
    });

    it("スレッドが存在しないメッセージは含めない", async () => {
      await insertMessage(db, {
        threadId: "orphan",
        createdAt: "2026-06-02T00:00:00.000Z",
      });

      const rows = await mastraMessageRepository.countUserMessagesByPlatform(
        d1,
        period,
      );

      expect(rows).toEqual([]);
    });
  });

  describe("countUserMessageTotals", () => {
    it("期間外のメッセージを除外する", async () => {
      await insertMessage(db, {
        threadId: "t-1",
        createdAt: "2026-06-02T00:00:00.000Z",
      });
      await insertMessage(db, {
        threadId: "t-2",
        createdAt: "2026-06-09T00:00:00.000Z",
      });

      const row = await mastraMessageRepository.countUserMessageTotals(
        d1,
        period,
      );

      expect(row).toEqual({ conversations: 1, messages: 1 });
    });
  });

  describe("findSpansOfUsedThreads", () => {
    it("llm_usage に記録のあるスレッドだけ最初と最後の時刻を返す", async () => {
      await db.insert(llmUsage).values({
        id: "u-1",
        model: "gpt-5-mini",
        source: "chat",
        threadId: "t-1",
        createdAt: "2026-06-02T00:00:00.000Z",
      });
      await insertMessage(db, {
        threadId: "t-1",
        createdAt: "2026-06-02T00:00:00.000Z",
      });
      await insertMessage(db, {
        threadId: "t-1",
        createdAt: "2026-06-02T03:00:00.000Z",
      });
      await insertMessage(db, {
        threadId: "t-2",
        createdAt: "2026-06-02T00:00:00.000Z",
      });

      const rows = await mastraMessageRepository.findSpansOfUsedThreads(
        d1,
        period,
      );

      expect(rows).toEqual([
        {
          threadId: "t-1",
          firstMessageAt: "2026-06-02T00:00:00.000Z",
          lastMessageAt: "2026-06-02T03:00:00.000Z",
        },
      ]);
    });

    it("assistant のメッセージも期間に含める", async () => {
      await db.insert(llmUsage).values({
        id: "u-1",
        model: "gpt-5-mini",
        source: "chat",
        threadId: "t-1",
        createdAt: "2026-06-02T00:00:00.000Z",
      });
      await insertMessage(db, {
        threadId: "t-1",
        role: "assistant",
        createdAt: "2026-06-02T05:00:00.000Z",
      });

      const rows = await mastraMessageRepository.findSpansOfUsedThreads(
        d1,
        period,
      );

      expect(rows[0]?.lastMessageAt).toBe("2026-06-02T05:00:00.000Z");
    });
  });

  describe("countByThread", () => {
    it("役割を問わずスレッドごとの件数を返す", async () => {
      await insertMessage(db, {
        threadId: "t-1",
        createdAt: "2026-06-02T00:00:00.000Z",
      });
      await insertMessage(db, {
        threadId: "t-1",
        role: "assistant",
        createdAt: "2026-06-02T00:00:00.000Z",
      });
      await insertMessage(db, {
        threadId: "t-2",
        createdAt: "2026-06-02T00:00:00.000Z",
      });

      const rows = await mastraMessageRepository.countByThread(d1);

      expect(
        Object.fromEntries(rows.map((r) => [r.threadId, r.count])),
      ).toEqual({ "t-1": 2, "t-2": 1 });
    });
  });

  describe("deleteCreatedBefore", () => {
    it("期限より前のメッセージを役割を問わず削除する", async () => {
      await insertMessage(db, {
        threadId: "t-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      await insertMessage(db, {
        threadId: "t-1",
        role: "assistant",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      await insertMessage(db, {
        threadId: "t-1",
        createdAt: "2026-06-01T00:00:00.000Z",
      });

      const deleted = await mastraMessageRepository.deleteCreatedBefore(
        d1,
        "2026-03-01T00:00:00.000Z",
      );

      expect(deleted).toBe(2);
      expect(await db.select().from(mastraMessages).all()).toHaveLength(1);
    });
  });

  describe("deleteByThreadId", () => {
    it("指定スレッドのメッセージだけを削除して件数を返す", async () => {
      await insertMessage(db, {
        threadId: "t-1",
        createdAt: "2026-06-01T00:00:00.000Z",
      });
      await insertMessage(db, {
        threadId: "t-2",
        createdAt: "2026-06-01T00:00:00.000Z",
      });

      const deleted = await mastraMessageRepository.deleteByThreadId(d1, "t-1");

      expect(deleted).toBe(1);
      const rows = await db.select().from(mastraMessages).all();
      expect(rows.map((r) => r.threadId)).toEqual(["t-2"]);
    });
  });
});
