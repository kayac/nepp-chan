import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { type DbClient, dataRetentionLogs } from "~/db";
import { deleteWithCount } from "./delete-with-count";

const log = (id: string, executedAt: string) => ({
  id,
  executedAt,
  targetTable: "llm_usage",
  deletedCount: 0,
  createdAt: executedAt,
});

describe("deleteWithCount", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("条件に一致した行を削除して件数を返す", async () => {
    await db.insert(dataRetentionLogs).values(log("l-1", "2026-06-01"));
    await db.insert(dataRetentionLogs).values(log("l-2", "2026-06-02"));

    const deleted = await deleteWithCount(
      db as unknown as DbClient,
      dataRetentionLogs,
      sql`${dataRetentionLogs.executedAt} = '2026-06-01'`,
    );

    expect(deleted).toBe(1);
    expect(await db.select().from(dataRetentionLogs).all()).toHaveLength(1);
  });

  it("一致する行が無ければ DELETE を発行しない", async () => {
    const spy = vi.spyOn(db, "delete");

    const deleted = await deleteWithCount(
      db as unknown as DbClient,
      dataRetentionLogs,
      sql`${dataRetentionLogs.executedAt} = '2026-06-01'`,
    );

    expect(deleted).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});
