import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";
import { retrievalRuns } from "~/db";

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

const { retrievalRunRepository } = await import("./retrieval-run-repository");

const d1 = {} as D1Database;

const run = (id: string, createdAt: string) => ({
  id,
  answerRunId: `ar-${id}`,
  threadId: "t-1",
  messageId: "m-1",
  turnIndex: 1,
  query: "村営バスの時刻",
  hits: "[]",
  durationMs: 100,
  createdAt,
});

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
  testDbHolder.db = db;
});

describe("deleteCreatedBefore", () => {
  it("期限より前の検索記録だけを削除する", async () => {
    await db
      .insert(retrievalRuns)
      .values([
        run("old", "2029-01-01T00:00:00Z"),
        run("new", "2031-01-01T00:00:00Z"),
      ]);

    const deleted = await retrievalRunRepository.deleteCreatedBefore(
      d1,
      "2030-01-01T00:00:00Z",
    );

    expect(deleted).toBe(1);
    const remaining = await db.select().from(retrievalRuns).all();
    expect(remaining.map((r) => r.id)).toEqual(["new"]);
  });

  it("対象が無ければ 0 を返す", async () => {
    const deleted = await retrievalRunRepository.deleteCreatedBefore(
      d1,
      "2030-01-01T00:00:00Z",
    );

    expect(deleted).toBe(0);
  });
});
