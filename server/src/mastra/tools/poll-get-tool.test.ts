import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/poll-repository", () => ({
  pollRepository: {
    findById: vi.fn(),
    findAll: vi.fn(),
  },
}));

vi.mock("~/services/poll-response", () => ({
  getPollResults: vi.fn(),
}));

const { pollRepository } = await import("~/repository/poll-repository");
const { getPollResults } = await import("~/services/poll-response");
const { pollGetTool } = await import("./poll-get-tool");

import { callTool } from "~/__tests__/helpers/tool-context";

const fakeDb = {} as D1Database;
const dbValues = { db: fakeDb };

const dbRow = {
  id: "p-1",
  title: "好きな季節",
  choices: JSON.stringify(["春", "夏"]),
  followUpPrompt: null,
  status: "sent" as const,
  createdBy: "u-1",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
  scheduledAt: null,
  sentAt: "2025-01-02T00:00:00Z",
  closedAt: null,
};

const sampleResults = {
  pollId: "p-1",
  title: "好きな季節",
  totalSubmissions: 2,
  choiceResults: [
    { choice: "春", count: 1, percentage: 50 },
    { choice: "夏", count: 1, percentage: 50 },
  ],
};

describe("pollGetTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("id 指定: sent の poll なら 1 件返す", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
    vi.mocked(getPollResults).mockResolvedValue(sampleResults);

    const result = await callTool(
      pollGetTool,
      { id: "p-1", limit: 10 },
      dbValues,
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.polls[0]).toMatchObject({
      id: "p-1",
      choices: ["春", "夏"],
      totalSubmissions: 2,
    });
  });

  it("id 指定: draft / scheduled は対象外", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue({
      ...dbRow,
      status: "draft",
    });

    const result = await callTool(
      pollGetTool,
      { id: "p-1", limit: 10 },
      dbValues,
    );

    expect(result.count).toBe(0);
    expect(result.message).toMatch(/見つかりません/);
  });

  it("引数なし: sent / closed の最新リストを返す", async () => {
    vi.mocked(pollRepository.findAll).mockResolvedValue({
      polls: [dbRow],
      nextCursor: null,
      hasMore: false,
    });
    vi.mocked(getPollResults).mockResolvedValue(sampleResults);

    const result = await callTool(pollGetTool, { limit: 10 }, dbValues);

    expect(pollRepository.findAll).toHaveBeenCalledWith(fakeDb, {
      limit: 10,
      status: ["sent", "closed"],
    });
    expect(result.count).toBe(1);
  });

  it("DB なしは DB_NOT_AVAILABLE", async () => {
    const result = await callTool(pollGetTool, { limit: 10 }, {});

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB_NOT_AVAILABLE");
  });
});
