import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/persona-repository", () => ({
  personaRepository: {
    list: vi.fn(),
    getStats: vi.fn(),
  },
}));

const { personaRepository } = await import("~/repository/persona-repository");
const { adminPersonaTool } = await import("./admin-persona-tool");

import { callTool } from "~/__tests__/helpers/tool-context";

const fakeDb = {} as D1Database;
const adminUser = { id: "u-1", role: "admin" as const };
const adminValues = { db: fakeDb, adminUser };

const samplePersona = {
  id: "p-1",
  resourceId: "v-1",
  category: "意見",
  tags: null,
  content: "x",
  source: null,
  topic: null,
  sentiment: "neutral",
  demographicSummary: null,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
  conversationEndedAt: null,
};

const sampleStats = {
  total: 10,
  byCategory: { 意見: 5, 要望: 3 },
  bySentiment: { neutral: 5, positive: 5 },
};

describe("adminPersonaTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: personas + stats を返す", async () => {
    vi.mocked(personaRepository.list).mockResolvedValue({
      personas: [samplePersona],
      nextCursor: null,
      hasMore: false,
    });
    vi.mocked(personaRepository.getStats).mockResolvedValue(sampleStats);

    const result = await callTool(adminPersonaTool, { limit: 30 }, adminValues);

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.summary?.totalCount).toBe(10);
  });

  it("category / sentiment フィルタを repository に渡す", async () => {
    vi.mocked(personaRepository.list).mockResolvedValue({
      personas: [],
      nextCursor: null,
      hasMore: false,
    });
    vi.mocked(personaRepository.getStats).mockResolvedValue(sampleStats);

    await callTool(
      adminPersonaTool,
      { category: "要望", sentiment: "request", limit: 30 },
      adminValues,
    );

    expect(personaRepository.list).toHaveBeenCalledWith(fakeDb, {
      category: "要望",
      sentiment: "request",
      limit: 30,
    });
  });

  it("非管理者は NOT_AUTHORIZED", async () => {
    const result = await callTool(
      adminPersonaTool,
      { limit: 30 },
      { db: fakeDb },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_AUTHORIZED");
  });

  it("repository が throw したら success=false で error を返す", async () => {
    vi.mocked(personaRepository.list).mockRejectedValueOnce(
      new Error("db error"),
    );

    const result = await callTool(adminPersonaTool, { limit: 30 }, adminValues);

    expect(result.success).toBe(false);
    expect(result.error).toBe("db error");
    expect(result.personas).toEqual([]);
  });

  it("非 Error の throw は Unknown error", async () => {
    vi.mocked(personaRepository.list).mockRejectedValueOnce("oops");

    const result = await callTool(adminPersonaTool, { limit: 30 }, adminValues);

    expect(result.error).toBe("Unknown error");
  });
});
