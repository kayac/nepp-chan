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

const { polls, pollSubmissions } = await import("~/db");
const { pollRepository } = await import("./poll-repository");

const fakeD1 = {} as D1Database;

const baseInput = {
  id: "p-1",
  title: "好きな季節",
  choices: JSON.stringify(["春", "夏", "秋", "冬"]),
  status: "draft" as const,
  createdBy: "u-1",
  createdAt: "2025-01-01T00:00:00Z",
};

describe("pollRepository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    testDbHolder.db = db;
  });

  describe("create", () => {
    it("挿入して id を返す", async () => {
      const id = await pollRepository.create(fakeD1, baseInput);

      expect(id).toBe("p-1");
      const saved = await pollRepository.findById(fakeD1, "p-1");
      expect(saved).toMatchObject({ id: "p-1", title: "好きな季節" });
    });

    it("followUpPrompt 未指定は null で保存", async () => {
      await pollRepository.create(fakeD1, baseInput);
      const saved = await pollRepository.findById(fakeD1, "p-1");

      expect(saved?.followUpPrompt).toBeNull();
    });
  });

  describe("update", () => {
    it("status 遷移を反映する", async () => {
      await pollRepository.create(fakeD1, baseInput);

      await pollRepository.update(fakeD1, "p-1", { status: "sent" });

      const saved = await pollRepository.findById(fakeD1, "p-1");
      expect(saved?.status).toBe("sent");
      expect(saved?.updatedAt).not.toBeNull();
    });

    it("title だけ更新しても他フィールドは保持される", async () => {
      await pollRepository.create(fakeD1, baseInput);

      await pollRepository.update(fakeD1, "p-1", { title: "新タイトル" });

      const saved = await pollRepository.findById(fakeD1, "p-1");
      expect(saved?.title).toBe("新タイトル");
      expect(saved?.choices).toBe(baseInput.choices);
    });
  });

  describe("findAll", () => {
    const seed = async (count: number) => {
      for (let i = 0; i < count; i += 1) {
        await pollRepository.create(fakeD1, {
          ...baseInput,
          id: `p-${i.toString().padStart(2, "0")}`,
          createdAt: new Date(Date.UTC(2025, 0, 1, 0, 0, i)).toISOString(),
        });
      }
    };

    it("createdAt 降順で取得", async () => {
      await seed(3);
      const result = await pollRepository.findAll(fakeD1);

      expect(result.polls.map((p) => p.id)).toEqual(["p-02", "p-01", "p-00"]);
    });

    it("limit を超えるレコードがあれば hasMore=true", async () => {
      await seed(5);
      const result = await pollRepository.findAll(fakeD1, { limit: 2 });

      expect(result.polls).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it("各 poll の answerCount に回答数を含む", async () => {
      await seed(2);
      await pollRepository.createSubmission(fakeD1, {
        id: "sub-1",
        pollId: "p-00",
        userId: "u-1",
        selectedChoice: "春",
        createdAt: "2025-01-02T00:00:00Z",
      });
      await pollRepository.createSubmission(fakeD1, {
        id: "sub-2",
        pollId: "p-00",
        userId: "u-2",
        selectedChoice: "夏",
        createdAt: "2025-01-02T00:00:01Z",
      });

      const result = await pollRepository.findAll(fakeD1);

      expect(result.polls.find((p) => p.id === "p-00")?.answerCount).toBe(2);
      expect(result.polls.find((p) => p.id === "p-01")?.answerCount).toBe(0);
    });

    it("status の配列で複数 status 絞り込み", async () => {
      await pollRepository.create(fakeD1, { ...baseInput, id: "draft-1" });
      await pollRepository.create(fakeD1, {
        ...baseInput,
        id: "sent-1",
        status: "sent",
      });
      await pollRepository.create(fakeD1, {
        ...baseInput,
        id: "closed-1",
        status: "closed",
      });

      const result = await pollRepository.findAll(fakeD1, {
        status: ["sent", "closed"],
      });

      expect(result.polls.map((p) => p.id).sort()).toEqual([
        "closed-1",
        "sent-1",
      ]);
    });
  });

  describe("delete", () => {
    it("poll とその submissions を一緒に削除する", async () => {
      await pollRepository.create(fakeD1, baseInput);
      await pollRepository.createSubmission(fakeD1, {
        id: "sub-1",
        pollId: "p-1",
        userId: "u-1",
        selectedChoice: "春",
        createdAt: "2025-01-02T00:00:00Z",
      });

      await pollRepository.delete(fakeD1, "p-1");

      expect(await pollRepository.findById(fakeD1, "p-1")).toBeNull();
      const subs = await db.select().from(pollSubmissions);
      expect(subs).toHaveLength(0);
    });
  });

  describe("findScheduledReady", () => {
    it("scheduled かつ scheduledAt <= now のものだけ", async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      const future = new Date(Date.now() + 60_000).toISOString();

      await db.insert(polls).values([
        {
          ...baseInput,
          id: "ready",
          status: "scheduled",
          scheduledAt: past,
        },
        {
          ...baseInput,
          id: "future",
          status: "scheduled",
          scheduledAt: future,
        },
        { ...baseInput, id: "draft" },
      ]);

      const result = await pollRepository.findScheduledReady(fakeD1);

      expect(result.map((r) => r.id)).toEqual(["ready"]);
    });
  });

  describe("findSentSince", () => {
    it("since より新しい sentAt の sent/closed のみ", async () => {
      await db.insert(polls).values([
        {
          ...baseInput,
          id: "old-sent",
          status: "sent",
          sentAt: "2025-01-01T00:00:00Z",
        },
        {
          ...baseInput,
          id: "new-sent",
          status: "sent",
          sentAt: "2025-01-02T00:00:00Z",
        },
        {
          ...baseInput,
          id: "new-closed",
          status: "closed",
          sentAt: "2025-01-03T00:00:00Z",
        },
        { ...baseInput, id: "draft" },
      ]);

      const result = await pollRepository.findSentSince(
        fakeD1,
        "2025-01-01T12:00:00Z",
      );

      expect(result.map((r) => r.id)).toEqual(["new-sent", "new-closed"]);
    });
  });

  describe("submissions", () => {
    beforeEach(async () => {
      await pollRepository.create(fakeD1, baseInput);
    });

    it("findSubmission: 該当する poll/user の組み合わせを返す", async () => {
      await pollRepository.createSubmission(fakeD1, {
        id: "sub-1",
        pollId: "p-1",
        userId: "user-A",
        selectedChoice: "春",
        createdAt: "2025-01-02T00:00:00Z",
      });

      const result = await pollRepository.findSubmission(
        fakeD1,
        "p-1",
        "user-A",
      );

      expect(result?.selectedChoice).toBe("春");
    });

    it("findSubmission: 該当なしは null", async () => {
      const result = await pollRepository.findSubmission(
        fakeD1,
        "p-1",
        "ghost",
      );
      expect(result).toBeNull();
    });

    it("findSubmissionsByPoll: 同じ poll の全件返す", async () => {
      await pollRepository.createSubmission(fakeD1, {
        id: "s-1",
        pollId: "p-1",
        userId: "u1",
        selectedChoice: "春",
        createdAt: "2025-01-02T00:00:00Z",
      });
      await pollRepository.createSubmission(fakeD1, {
        id: "s-2",
        pollId: "p-1",
        userId: "u2",
        selectedChoice: "夏",
        createdAt: "2025-01-02T00:01:00Z",
      });

      const result = await pollRepository.findSubmissionsByPoll(fakeD1, "p-1");

      expect(result).toHaveLength(2);
    });

    it("UNIQUE 制約: 同じ user が同じ poll に 2 度回答できない", async () => {
      await pollRepository.createSubmission(fakeD1, {
        id: "s-1",
        pollId: "p-1",
        userId: "u1",
        selectedChoice: "春",
        createdAt: "2025-01-02T00:00:00Z",
      });

      await expect(
        pollRepository.createSubmission(fakeD1, {
          id: "s-2",
          pollId: "p-1",
          userId: "u1",
          selectedChoice: "夏",
          createdAt: "2025-01-02T00:01:00Z",
        }),
      ).rejects.toThrow();
    });
  });
});
