import { sql } from "drizzle-orm";
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

const { createDb } = await import("~/db");
const { deleteWithCount } = await import("./delete-with-count");

const fakeD1 = {} as D1Database;

const log = (id: string, executedAt: string) => ({
  id,
  executedAt,
  targetTable: "llm_usage",
  deletedCount: 0,
  createdAt: executedAt,
});

const executedOn = (executedAt: string) =>
  sql`${dataRetentionLogs.executedAt} = ${executedAt}`;

describe("deleteWithCount", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  it("条件に一致した行を削除して件数を返す", async () => {
    await db.insert(dataRetentionLogs).values(log("l-1", "2026-06-01"));
    await db.insert(dataRetentionLogs).values(log("l-2", "2026-06-02"));

    const deleted = await deleteWithCount(
      createDb(fakeD1),
      dataRetentionLogs,
      executedOn("2026-06-01"),
    );

    expect(deleted).toBe(1);
    const remaining = await db.select().from(dataRetentionLogs).all();
    expect(remaining.map((r) => r.id)).toEqual(["l-2"]);
  });

  it("一致する行が無ければ DELETE を発行しない", async () => {
    const spy = vi.spyOn(db, "delete");

    const deleted = await deleteWithCount(
      createDb(fakeD1),
      dataRetentionLogs,
      executedOn("2026-06-01"),
    );

    expect(deleted).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});
