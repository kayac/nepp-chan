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

const { knowledgeCorrectionRepository } = await import(
  "./knowledge-correction-repository"
);

const d1 = {} as D1Database;

const baseCorrection = {
  id: "cor-1",
  correctsSourcePath: "bus/index.md",
  body: "土曜は運休です",
  verifiedAt: "2026-09-01",
  approvedBy: "admin-1",
  createdAt: "2026-09-01T00:00:00.000Z",
};

describe("knowledgeCorrectionRepository", () => {
  beforeEach(async () => {
    testDbHolder.db = await createTestDb();
  });

  it("insert したものを findById / list で取得できる", async () => {
    await knowledgeCorrectionRepository.insert(d1, baseCorrection);

    const found = await knowledgeCorrectionRepository.findById(d1, "cor-1");
    expect(found).toMatchObject({
      id: "cor-1",
      status: "published",
      body: "土曜は運休です",
    });

    const all = await knowledgeCorrectionRepository.list(d1);
    expect(all).toHaveLength(1);
  });

  it("listPublishedByCorrects は published かつ対象 source のものだけ返す", async () => {
    await knowledgeCorrectionRepository.insert(d1, baseCorrection);
    await knowledgeCorrectionRepository.insert(d1, {
      ...baseCorrection,
      id: "cor-retired",
      status: "retired",
    });
    await knowledgeCorrectionRepository.insert(d1, {
      ...baseCorrection,
      id: "cor-other",
      correctsSourcePath: "other.md",
    });

    const rows = await knowledgeCorrectionRepository.listPublishedByCorrects(
      d1,
      ["bus/index.md"],
    );
    expect(rows.map((r) => r.id)).toEqual(["cor-1"]);
  });

  it("listPublishedByCorrects は空配列入力で空を返す", async () => {
    expect(
      await knowledgeCorrectionRepository.listPublishedByCorrects(d1, []),
    ).toEqual([]);
  });

  it("markNeedsReviewByCorrects は published の該当訂正だけに立てる", async () => {
    await knowledgeCorrectionRepository.insert(d1, baseCorrection);
    await knowledgeCorrectionRepository.insert(d1, {
      ...baseCorrection,
      id: "cor-retired",
      status: "retired",
    });

    await knowledgeCorrectionRepository.markNeedsReviewByCorrects(
      d1,
      "bus/index.md",
      "source_updated",
    );

    const flagged = await knowledgeCorrectionRepository.findById(d1, "cor-1");
    expect(flagged?.needsReviewAt).not.toBeNull();
    const retired = await knowledgeCorrectionRepository.findById(
      d1,
      "cor-retired",
    );
    expect(retired?.needsReviewAt).toBeNull();
  });

  it("markNeedsReviewByCorrects は既にフラグ済みの日時を上書きしない", async () => {
    await knowledgeCorrectionRepository.insert(d1, baseCorrection);
    await knowledgeCorrectionRepository.markNeedsReviewByCorrects(
      d1,
      "bus/index.md",
      "source_updated",
    );
    const first = await knowledgeCorrectionRepository.findById(d1, "cor-1");

    await knowledgeCorrectionRepository.markNeedsReviewByCorrects(
      d1,
      "bus/index.md",
      "source_updated",
    );
    const second = await knowledgeCorrectionRepository.findById(d1, "cor-1");
    expect(second?.needsReviewAt).toBe(first?.needsReviewAt);
  });

  it("update で needsReviewAt をクリアできる", async () => {
    await knowledgeCorrectionRepository.insert(d1, {
      ...baseCorrection,
      needsReviewAt: "2026-09-02T00:00:00.000Z",
    });

    const updated = await knowledgeCorrectionRepository.update(d1, "cor-1", {
      needsReviewAt: null,
      verifiedAt: "2026-09-03",
    });

    expect(updated.needsReviewAt).toBeNull();
    expect(updated.verifiedAt).toBe("2026-09-03");
  });
});
