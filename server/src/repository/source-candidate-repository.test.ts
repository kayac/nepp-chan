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

const { sourceCandidateRepository } = await import(
  "./source-candidate-repository"
);

const d1 = {} as D1Database;

const baseCandidate = {
  id: "cand-1",
  url: "https://vill.example.jp/garbage",
  lastSeenAt: "2026-09-01T00:00:00.000Z",
  createdAt: "2026-09-01T00:00:00.000Z",
};

describe("sourceCandidateRepository", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
  });

  it("insert したものを findByUrl / findById で取得できる", async () => {
    await sourceCandidateRepository.insert(d1, baseCandidate);

    const byUrl = await sourceCandidateRepository.findByUrl(
      d1,
      baseCandidate.url,
    );
    expect(byUrl).toMatchObject({
      id: "cand-1",
      status: "pending",
      occurrenceCount: 1,
    });
    expect(
      await sourceCandidateRepository.findById(d1, "cand-1"),
    ).not.toBeNull();
  });

  it("list は出現回数の多い順に返す", async () => {
    await sourceCandidateRepository.insert(d1, baseCandidate);
    await sourceCandidateRepository.insert(d1, {
      ...baseCandidate,
      id: "cand-2",
      url: "https://vill.example.jp/bus",
      occurrenceCount: 5,
    });

    const rows = await sourceCandidateRepository.list(d1);
    expect(rows.map((r) => r.id)).toEqual(["cand-2", "cand-1"]);
  });

  it("upsertOccurrence は初回は 1 件目として登録する", async () => {
    const row = await sourceCandidateRepository.upsertOccurrence(d1, {
      url: baseCandidate.url,
      relatedAnswerRunId: "ar-1",
    });

    expect(row).toMatchObject({
      status: "pending",
      occurrenceCount: 1,
      relatedAnswerRunId: "ar-1",
    });
  });

  it("upsertOccurrence は同一 URL の出現回数を SQL 側で加算する", async () => {
    await sourceCandidateRepository.insert(d1, baseCandidate);

    const row = await sourceCandidateRepository.upsertOccurrence(d1, {
      url: baseCandidate.url,
      relatedAnswerRunId: "ar-9",
    });

    expect(row).toMatchObject({
      id: "cand-1",
      occurrenceCount: 2,
      relatedAnswerRunId: "ar-9",
    });
    expect(row.lastSeenAt).not.toBe(baseCandidate.lastSeenAt);
  });

  it("updateStatus は判断者と判断日時を記録する", async () => {
    await sourceCandidateRepository.insert(d1, baseCandidate);

    const updated = await sourceCandidateRepository.updateStatus(d1, "cand-1", {
      status: "approved",
      decidedBy: "admin-1",
    });

    expect(updated).toMatchObject({
      status: "approved",
      decidedBy: "admin-1",
    });
    expect(updated.decidedAt).not.toBeNull();
  });
});
