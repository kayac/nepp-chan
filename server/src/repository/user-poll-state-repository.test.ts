import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "~/__tests__/helpers/test-db";

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

const { userPollStateRepository } = await import(
  "./user-poll-state-repository"
);

const fakeD1 = {} as D1Database;

describe("userPollStateRepository", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
  });

  it("findByUserId: 該当なしは null", async () => {
    const result = await userPollStateRepository.findByUserId(fakeD1, "u1");
    expect(result).toBeNull();
  });

  it("upsert 初回 → INSERT", async () => {
    await userPollStateRepository.upsert(fakeD1, "u1", "2025-01-01T00:00:00Z");

    const result = await userPollStateRepository.findByUserId(fakeD1, "u1");
    expect(result?.lastInjectedAt).toBe("2025-01-01T00:00:00Z");
  });

  it("upsert 2 回目 → 上書き", async () => {
    await userPollStateRepository.upsert(fakeD1, "u1", "2025-01-01T00:00:00Z");
    await userPollStateRepository.upsert(fakeD1, "u1", "2025-01-02T00:00:00Z");

    const result = await userPollStateRepository.findByUserId(fakeD1, "u1");
    expect(result?.lastInjectedAt).toBe("2025-01-02T00:00:00Z");
  });
});
