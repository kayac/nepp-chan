import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/poll-repository", () => ({
  pollRepository: {
    findById: vi.fn(),
    findSubmissionsByPoll: vi.fn(),
  },
}));

const { pollRepository } = await import("~/repository/poll-repository");
const { getPollResults } = await import("./poll-results");

const env = {
  DB: {} as D1Database,
} as unknown as CloudflareBindings;

const dbRow = {
  id: "p-1",
  title: "好きな季節",
  choices: JSON.stringify(["春", "夏", "秋", "冬"]),
  followUpPrompt: null,
  status: "sent" as const,
  createdBy: "u-1",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
  scheduledAt: null,
  sentAt: "2025-01-02T00:00:00Z",
  closedAt: null,
};

describe("getPollResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("存在しなければ null", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(null);
    expect(await getPollResults(env.DB, "p-1")).toBeNull();
  });

  it("各選択肢の件数 / パーセンテージを返す", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
    vi.mocked(pollRepository.findSubmissionsByPoll).mockResolvedValue([
      {
        id: "1",
        pollId: "p-1",
        userId: "u1",
        selectedChoice: "春",
        createdAt: "x",
      },
      {
        id: "2",
        pollId: "p-1",
        userId: "u2",
        selectedChoice: "春",
        createdAt: "x",
      },
      {
        id: "3",
        pollId: "p-1",
        userId: "u3",
        selectedChoice: "冬",
        createdAt: "x",
      },
    ]);

    const result = await getPollResults(env.DB, "p-1");

    expect(result?.totalSubmissions).toBe(3);
    expect(result?.choiceResults).toEqual([
      { choice: "春", count: 2, percentage: 67 },
      { choice: "夏", count: 0, percentage: 0 },
      { choice: "秋", count: 0, percentage: 0 },
      { choice: "冬", count: 1, percentage: 33 },
    ]);
  });

  it("回答ゼロでも全選択肢を 0% で返す", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
    vi.mocked(pollRepository.findSubmissionsByPoll).mockResolvedValue([]);

    const result = await getPollResults(env.DB, "p-1");

    expect(result?.totalSubmissions).toBe(0);
    expect(result?.choiceResults.every((c) => c.percentage === 0)).toBe(true);
  });

  it("候補外の choice が submission に紛れていても無視される", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
    vi.mocked(pollRepository.findSubmissionsByPoll).mockResolvedValue([
      {
        id: "1",
        pollId: "p-1",
        userId: "u1",
        selectedChoice: "謎の選択肢",
        createdAt: "x",
      },
    ]);

    const result = await getPollResults(env.DB, "p-1");

    expect(result?.choiceResults.every((c) => c.count === 0)).toBe(true);
  });
});
