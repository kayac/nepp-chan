import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { dataRetentionLogs } from "~/db";

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

const { dataRetentionLogRepository } = await import(
  "./data-retention-log-repository"
);

const d1 = {} as D1Database;

const log = (id: string, executedAt: string) => ({
  id,
  executedAt,
  targetTable: "llm_usage",
  deletedCount: 3,
  createdAt: executedAt,
});

describe("dataRetentionLogRepository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  it("記録した実行ログを取得できる", async () => {
    await dataRetentionLogRepository.create(
      d1,
      log("l-1", "2026-06-01T00:00:00.000Z"),
    );

    const rows = await db.select().from(dataRetentionLogs).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedCount).toBe(3);
  });

  it("実行時刻が期限より前のログを削除する", async () => {
    await db
      .insert(dataRetentionLogs)
      .values(log("l-old", "2026-01-01T00:00:00.000Z"));
    await db
      .insert(dataRetentionLogs)
      .values(log("l-new", "2026-06-01T00:00:00.000Z"));

    const deleted = await dataRetentionLogRepository.deleteExecutedBefore(
      d1,
      "2026-03-01T00:00:00.000Z",
    );

    expect(deleted).toBe(1);
    const remaining = await db.select().from(dataRetentionLogs).all();
    expect(remaining.map((r) => r.id)).toEqual(["l-new"]);
  });
});
