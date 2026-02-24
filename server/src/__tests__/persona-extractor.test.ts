import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted で vi.mock 内から参照できる変数を定義
const { mockGet, mockSelect, mockDelete, mockDeleteFrom, mockMemoryRecall } =
  vi.hoisted(() => {
    const mockGet = vi.fn();
    const mockAll = vi.fn();
    const mockWhere = vi.fn().mockReturnValue({ get: mockGet, all: mockAll });
    const mockFrom = vi
      .fn()
      .mockReturnValue({ where: mockWhere, get: mockGet });
    const mockDeleteFrom = vi.fn().mockResolvedValue(undefined);
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    const mockDelete = vi.fn().mockReturnValue(mockDeleteFrom);
    const mockMemoryRecall = vi.fn();
    return {
      mockGet,
      mockAll,
      mockWhere,
      mockFrom,
      mockSelect,
      mockDelete,
      mockDeleteFrom,
      mockMemoryRecall,
    };
  });

vi.mock("~/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/db")>();
  return {
    ...actual,
    createDb: vi.fn().mockReturnValue({
      select: mockSelect,
      delete: mockDelete,
    }),
  };
});

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({}),
}));

vi.mock("@mastra/memory", () => ({
  Memory: vi.fn().mockImplementation(() => ({
    recall: mockMemoryRecall,
  })),
}));

vi.mock("~/mastra/memory", () => ({
  getWorkingMemoryByThread: vi.fn().mockResolvedValue(null),
}));

vi.mock("@mastra/core/mastra", () => ({
  Mastra: vi.fn().mockImplementation(() => ({
    getAgent: vi.fn().mockReturnValue({
      generate: vi.fn().mockResolvedValue({}),
    }),
  })),
}));

vi.mock("~/mastra/agents/persona-agent", () => ({
  personaAgent: {},
}));

vi.mock("~/mastra/request-context", () => ({
  createRequestContext: vi.fn().mockReturnValue({}),
}));

vi.mock("~/repository/thread-persona-status-repository", () => ({
  threadPersonaStatusRepository: {
    findByThreadId: vi.fn(),
    upsert: vi.fn(),
  },
}));

import { threadPersonaStatusRepository } from "~/repository/thread-persona-status-repository";
import {
  deleteAllPersonas,
  extractPersonaFromThreadById,
} from "~/services/persona-extractor";

describe("extractPersonaFromThreadById", () => {
  const threadId = "thread-123";
  const mockEnv = { DB: {} as D1Database } as CloudflareBindings;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("スレッド未存在で HTTPException(404) をスローする", async () => {
    mockGet.mockResolvedValue(null);

    await expect(
      extractPersonaFromThreadById(threadId, mockEnv),
    ).rejects.toThrow(HTTPException);

    await expect(
      extractPersonaFromThreadById(threadId, mockEnv),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it("抽出成功時にステータスを更新してメッセージを返す", async () => {
    mockGet.mockResolvedValue({ id: threadId, resourceId: "village-1" });

    vi.mocked(threadPersonaStatusRepository.findByThreadId).mockResolvedValue(
      null,
    );
    // extractPersonaFromThread に必要なモック設定
    mockMemoryRecall.mockResolvedValue({
      messages: [
        { role: "user", content: "こんにちは", createdAt: new Date() },
        { role: "assistant", content: "はい", createdAt: new Date() },
      ],
    });
    vi.mocked(threadPersonaStatusRepository.upsert).mockResolvedValue(
      undefined,
    );

    const result = await extractPersonaFromThreadById(threadId, mockEnv);

    expect(result.message).toContain(threadId);
    expect(result.message).toContain("抽出しました");
    expect(threadPersonaStatusRepository.upsert).toHaveBeenCalledWith(
      mockEnv.DB,
      expect.objectContaining({
        threadId,
        lastMessageCount: 2,
      }),
    );
  });

  it("スキップ時にステータス更新しない（新規メッセージなし）", async () => {
    mockGet.mockResolvedValue({ id: threadId, resourceId: "village-1" });

    // lastMessageCount = 2 で、メッセージも 2 件 → no_new_messages
    vi.mocked(threadPersonaStatusRepository.findByThreadId).mockResolvedValue({
      threadId,
      lastExtractedAt: "2024-01-01T00:00:00Z",
      lastMessageCount: 2,
    });
    mockMemoryRecall.mockResolvedValue({
      messages: [
        { role: "user", content: "こんにちは" },
        { role: "assistant", content: "はい" },
      ],
    });

    const result = await extractPersonaFromThreadById(threadId, mockEnv);

    expect(threadPersonaStatusRepository.upsert).not.toHaveBeenCalled();
    expect(result.result).toEqual({
      skipped: true,
      reason: "no_new_messages",
    });
  });

  it("スキップ時に正しい reason メッセージを返す", async () => {
    mockGet.mockResolvedValue({ id: threadId, resourceId: "village-1" });

    vi.mocked(threadPersonaStatusRepository.findByThreadId).mockResolvedValue({
      threadId,
      lastExtractedAt: "2024-01-01T00:00:00Z",
      lastMessageCount: 2,
    });
    mockMemoryRecall.mockResolvedValue({
      messages: [
        { role: "user", content: "こんにちは" },
        { role: "assistant", content: "はい" },
      ],
    });

    const result = await extractPersonaFromThreadById(threadId, mockEnv);

    expect(result.message).toContain("スキップされました");
    expect(result.message).toContain("no_new_messages");
  });
});

describe("deleteAllPersonas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persona と threadPersonaStatus の両テーブルを削除する", async () => {
    mockGet.mockResolvedValue({ count: 5 });
    mockDeleteFrom.mockResolvedValue(undefined);

    await deleteAllPersonas({} as D1Database);

    expect(mockDelete).toHaveBeenCalledTimes(2);
  });

  it("削除前の件数を返す", async () => {
    mockGet.mockResolvedValue({ count: 5 });
    mockDeleteFrom.mockResolvedValue(undefined);

    const result = await deleteAllPersonas({} as D1Database);

    expect(result.count).toBe(5);
  });

  it("0件の場合も正常に動作する", async () => {
    mockGet.mockResolvedValue({ count: 0 });
    mockDeleteFrom.mockResolvedValue(undefined);

    const result = await deleteAllPersonas({} as D1Database);

    expect(result.count).toBe(0);
  });
});
