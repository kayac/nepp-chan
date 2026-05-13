import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/feedback-repository", () => ({
  feedbackRepository: {
    list: vi.fn(),
    getStats: vi.fn(),
  },
}));

const { feedbackRepository } = await import("~/repository/feedback-repository");
const { adminFeedbackTool } = await import("./admin-feedback-tool");

import { callTool } from "../../test-helpers/tool-context";

const fakeDb = {} as D1Database;
const adminUser = { id: "u-1", role: "admin" as const };
const adminValues = { db: fakeDb, adminUser };

const sampleFeedback = {
  id: "f-1",
  threadId: "t-1",
  messageId: "m-1",
  rating: "good",
  category: null,
  comment: null,
  conversationContext: "{}",
  toolExecutions: null,
  createdAt: "2025-01-01T00:00:00Z",
  resolvedAt: null,
};

const sampleStats = {
  total: 10,
  good: 7,
  bad: 2,
  idea: 1,
  byCategory: {},
};

describe("adminFeedbackTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: feedbacks + stats を返す", async () => {
    vi.mocked(feedbackRepository.list).mockResolvedValue({
      feedbacks: [sampleFeedback],
      nextCursor: null,
      hasMore: false,
    });
    vi.mocked(feedbackRepository.getStats).mockResolvedValue(sampleStats);

    const result = await callTool(
      adminFeedbackTool,
      { limit: 30, includeStats: true },
      adminValues,
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.stats).toEqual(sampleStats);
  });

  it("includeStats: false なら stats を取らない", async () => {
    vi.mocked(feedbackRepository.list).mockResolvedValue({
      feedbacks: [],
      nextCursor: null,
      hasMore: false,
    });

    const result = await callTool(
      adminFeedbackTool,
      { limit: 30, includeStats: false },
      adminValues,
    );

    expect(result.stats).toBeUndefined();
    expect(feedbackRepository.getStats).not.toHaveBeenCalled();
  });

  it("rating フィルタを repository に渡す", async () => {
    vi.mocked(feedbackRepository.list).mockResolvedValue({
      feedbacks: [],
      nextCursor: null,
      hasMore: false,
    });
    vi.mocked(feedbackRepository.getStats).mockResolvedValue(sampleStats);

    await callTool(
      adminFeedbackTool,
      { rating: "bad", limit: 30, includeStats: true },
      adminValues,
    );

    expect(feedbackRepository.list).toHaveBeenCalledWith(fakeDb, {
      rating: "bad",
      limit: 30,
    });
  });

  it("非管理者は NOT_AUTHORIZED", async () => {
    const result = await callTool(
      adminFeedbackTool,
      { limit: 30, includeStats: true },
      { db: fakeDb },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_AUTHORIZED");
  });

  it("メッセージに満足率を含む", async () => {
    vi.mocked(feedbackRepository.list).mockResolvedValue({
      feedbacks: [],
      nextCursor: null,
      hasMore: false,
    });
    vi.mocked(feedbackRepository.getStats).mockResolvedValue({
      total: 10,
      good: 8,
      bad: 2,
      idea: 0,
      byCategory: {},
    });

    const result = await callTool(
      adminFeedbackTool,
      { limit: 30, includeStats: true },
      adminValues,
    );

    expect(result.message).toMatch(/満足率: 80%/);
  });
});
