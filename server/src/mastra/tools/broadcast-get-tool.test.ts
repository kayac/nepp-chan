import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/broadcast-repository", () => ({
  broadcastRepository: {
    findById: vi.fn(),
    findAll: vi.fn(),
    findByKeyword: vi.fn(),
  },
}));

const { broadcastRepository } = await import(
  "~/repository/broadcast-repository"
);
const { broadcastGetTool } = await import("./broadcast-get-tool");

import { callTool } from "~/__tests__/helpers/tool-context";

const fakeDb = {} as D1Database;
const dbValues = { db: fakeDb };

const sample = {
  id: "b-1",
  title: "おしらせ",
  body: "本文",
  parts: null,
  status: "sent",
  scheduledAt: null,
  sentAt: "2025-01-01T00:00:00Z",
  errorMessage: null,
  createdBy: "u-1",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

describe("broadcastGetTool.execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("id 指定: 該当ありで 1 件返す", async () => {
    vi.mocked(broadcastRepository.findById).mockResolvedValue(sample);

    const result = await callTool(
      broadcastGetTool,
      { id: "b-1", limit: 10 },
      dbValues,
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });

  it("id 指定: 該当なしで 0 件 + 専用メッセージ", async () => {
    vi.mocked(broadcastRepository.findById).mockResolvedValue(null);

    const result = await callTool(
      broadcastGetTool,
      { id: "missing", limit: 10 },
      dbValues,
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
    expect(result.message).toMatch(/見つかりません/);
  });

  it("keyword 指定: findByKeyword の結果を返す", async () => {
    vi.mocked(broadcastRepository.findByKeyword).mockResolvedValue([sample]);

    const result = await callTool(
      broadcastGetTool,
      { keyword: "雪", limit: 5 },
      dbValues,
    );

    expect(broadcastRepository.findByKeyword).toHaveBeenCalledWith(
      fakeDb,
      "雪",
      5,
    );
    expect(result.count).toBe(1);
  });

  it("keyword ヒット 0 は専用メッセージ", async () => {
    vi.mocked(broadcastRepository.findByKeyword).mockResolvedValue([]);

    const result = await callTool(
      broadcastGetTool,
      { keyword: "ない", limit: 10 },
      dbValues,
    );

    expect(result.message).toMatch(/一致する.*ありません/);
  });

  it("引数なし: status=sent の最新を取る", async () => {
    vi.mocked(broadcastRepository.findAll).mockResolvedValue({
      broadcasts: [sample],
      nextCursor: null,
      hasMore: false,
    });

    const result = await callTool(broadcastGetTool, { limit: 10 }, dbValues);

    expect(broadcastRepository.findAll).toHaveBeenCalledWith(fakeDb, {
      limit: 10,
      status: "sent",
    });
    expect(result.count).toBe(1);
  });

  it("DB なしは DB_NOT_AVAILABLE", async () => {
    const result = await callTool(broadcastGetTool, { limit: 10 }, {});

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB_NOT_AVAILABLE");
  });

  it("repository が throw すると success: false で error を返す", async () => {
    vi.mocked(broadcastRepository.findAll).mockRejectedValue(new Error("db"));

    const result = await callTool(broadcastGetTool, { limit: 10 }, dbValues);

    expect(result.success).toBe(false);
    expect(result.error).toBe("db");
    expect(result.broadcasts).toEqual([]);
  });

  it("非 Error の throw は Unknown error", async () => {
    vi.mocked(broadcastRepository.findAll).mockRejectedValue("oops");

    const result = await callTool(broadcastGetTool, { limit: 10 }, dbValues);

    expect(result.error).toBe("Unknown error");
  });
});
