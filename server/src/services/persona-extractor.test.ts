import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted で vi.mock 内から参照できる変数を定義
const { mockGet, mockAll, mockSelect, mockMemoryRecall, mockGenerate } =
  vi.hoisted(() => {
    const mockGet = vi.fn();
    const mockAll = vi.fn();
    const mockOrderBy = vi.fn().mockReturnValue({ all: mockAll });
    const mockGroupBy = vi.fn().mockReturnValue({ all: mockAll });
    const mockWhere = vi.fn().mockReturnValue({ get: mockGet, all: mockAll });
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
      get: mockGet,
      orderBy: mockOrderBy,
      groupBy: mockGroupBy,
    });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    const mockMemoryRecall = vi.fn();
    const mockGenerate = vi.fn().mockResolvedValue({});
    return {
      mockGet,
      mockAll,
      mockWhere,
      mockFrom,
      mockSelect,
      mockMemoryRecall,
      mockGenerate,
    };
  });

vi.mock("~/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/db")>();
  return {
    ...actual,
    createDb: vi.fn().mockReturnValue({ select: mockSelect }),
  };
});

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({}),
}));

vi.mock("@mastra/memory", () => ({
  Memory: vi.fn(function () {
    return {
      recall: mockMemoryRecall,
    };
  }),
}));

vi.mock("~/mastra/memory", () => ({
  getWorkingMemoryByThread: vi.fn().mockResolvedValue(null),
}));

vi.mock("@mastra/core/mastra", () => ({
  Mastra: vi.fn(function () {
    return {
      getAgent: vi.fn().mockReturnValue({
        generate: mockGenerate,
      }),
    };
  }),
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
    findAll: vi.fn(),
    upsert: vi.fn(),
  },
}));

import { threadPersonaStatusRepository } from "~/repository/thread-persona-status-repository";
import {
  extractAllPendingThreads,
  extractPersonaFromThreadById,
} from "./persona-extractor";

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

describe("extractPersonaFromThreadById エラー処理", () => {
  const threadId = "thread-err";
  const mockEnv = { DB: {} as D1Database } as CloudflareBindings;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ id: threadId, resourceId: "village" });
    vi.mocked(threadPersonaStatusRepository.findByThreadId).mockResolvedValue(
      null,
    );
    mockMemoryRecall.mockResolvedValue({
      messages: [{ role: "user", content: "hi", createdAt: new Date() }],
    });
  });

  it("Invalid JSON response エラーは no_persona_found としてスキップ", async () => {
    mockGenerate.mockRejectedValueOnce(new Error("Invalid JSON response"));

    const result = await extractPersonaFromThreadById(threadId, mockEnv);

    expect(result.result).toMatchObject({
      skipped: true,
      reason: "no_persona_found",
    });
    expect(threadPersonaStatusRepository.upsert).not.toHaveBeenCalled();
  });

  it("その他のエラーは extraction_error としてスキップ", async () => {
    mockGenerate.mockRejectedValueOnce(new Error("boom"));

    const result = await extractPersonaFromThreadById(threadId, mockEnv);

    expect(result.result).toMatchObject({
      skipped: true,
      reason: "extraction_error",
    });
  });
});

describe("extractAllPendingThreads", () => {
  const mockEnv = { DB: {} as D1Database } as CloudflareBindings;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("スレッド 0 件なら空配列", async () => {
    vi.mocked(threadPersonaStatusRepository.findAll).mockResolvedValue([]);
    mockAll
      .mockResolvedValueOnce([]) // getAllThreads
      .mockResolvedValueOnce([]); // getMessageCountsByThread

    const result = await extractAllPendingThreads(mockEnv);
    expect(result).toEqual([]);
  });

  it("resourceId が null のスレッドは除外", async () => {
    vi.mocked(threadPersonaStatusRepository.findAll).mockResolvedValue([]);
    mockAll
      .mockResolvedValueOnce([
        { id: "t1", resourceId: null },
        { id: "t2", resourceId: "r2" },
      ])
      .mockResolvedValueOnce([{ threadId: "t2", count: 0 }]);

    const result = await extractAllPendingThreads(mockEnv);
    expect(result.map((r) => r.threadId)).toEqual(["t2"]);
  });

  it("DB のメッセージ数 <= lastMessageCount なら memory.recall を呼ばずにスキップ", async () => {
    vi.mocked(threadPersonaStatusRepository.findAll).mockResolvedValue([
      {
        threadId: "t1",
        lastExtractedAt: "2030-01-01T00:00:00Z",
        lastMessageCount: 5,
      },
    ]);
    mockAll
      .mockResolvedValueOnce([{ id: "t1", resourceId: "r1" }])
      .mockResolvedValueOnce([{ threadId: "t1", count: 5 }]);

    const result = await extractAllPendingThreads(mockEnv);

    expect(result[0].result).toMatchObject({
      skipped: true,
      reason: "no_new_messages",
    });
    expect(mockMemoryRecall).not.toHaveBeenCalled();
    expect(threadPersonaStatusRepository.upsert).not.toHaveBeenCalled();
  });

  it("メッセージ数が増えていれば extractPersonaFromThread を呼びステータスを更新", async () => {
    vi.mocked(threadPersonaStatusRepository.findAll).mockResolvedValue([]);
    mockAll
      .mockResolvedValueOnce([{ id: "t1", resourceId: "r1" }])
      .mockResolvedValueOnce([{ threadId: "t1", count: 3 }]);
    mockMemoryRecall.mockResolvedValue({
      messages: [
        { role: "user", content: "u1", createdAt: new Date() },
        { role: "assistant", content: "a1", createdAt: new Date() },
        { role: "user", content: "u2", createdAt: new Date() },
      ],
    });

    const result = await extractAllPendingThreads(mockEnv);

    expect(result[0].result).toMatchObject({ extracted: true });
    expect(threadPersonaStatusRepository.upsert).toHaveBeenCalledWith(
      mockEnv.DB,
      expect.objectContaining({
        threadId: "t1",
        lastMessageCount: 3,
      }),
    );
  });

  it("Invalid JSON エラー時も messageCount を含むスキップなら upsert する", async () => {
    vi.mocked(threadPersonaStatusRepository.findAll).mockResolvedValue([]);
    mockAll
      .mockResolvedValueOnce([{ id: "t1", resourceId: "r1" }])
      .mockResolvedValueOnce([{ threadId: "t1", count: 2 }]);
    mockMemoryRecall.mockResolvedValue({
      messages: [
        { role: "user", content: "u1", createdAt: new Date() },
        { role: "assistant", content: "a1", createdAt: new Date() },
      ],
    });
    mockGenerate.mockRejectedValueOnce(new Error("Invalid JSON response"));

    const result = await extractAllPendingThreads(mockEnv);

    expect(result[0].result).toMatchObject({
      skipped: true,
      reason: "no_persona_found",
    });
    expect(threadPersonaStatusRepository.upsert).toHaveBeenCalled();
  });

  it("recall を全件・古い順（perPage:false / createdAt ASC）で呼ぶ", async () => {
    vi.mocked(threadPersonaStatusRepository.findAll).mockResolvedValue([]);
    mockAll
      .mockResolvedValueOnce([{ id: "t1", resourceId: "r1" }])
      .mockResolvedValueOnce([{ threadId: "t1", count: 2 }]);
    mockMemoryRecall.mockResolvedValue({
      messages: [
        { role: "user", content: "u1", createdAt: new Date() },
        { role: "assistant", content: "a1", createdAt: new Date() },
      ],
    });

    await extractAllPendingThreads(mockEnv);

    expect(mockMemoryRecall).toHaveBeenCalledWith({
      threadId: "t1",
      perPage: false,
      orderBy: { field: "createdAt", direction: "ASC" },
    });
  });

  it("差分更新: 前回処理位置以降の新規メッセージのみ分析し lastMessageCount を全件数まで前進", async () => {
    vi.mocked(threadPersonaStatusRepository.findAll).mockResolvedValue([
      {
        threadId: "t1",
        lastExtractedAt: "2024-01-01T00:00:00Z",
        lastMessageCount: 2,
      },
    ]);
    mockAll
      .mockResolvedValueOnce([{ id: "t1", resourceId: "r1" }])
      .mockResolvedValueOnce([{ threadId: "t1", count: 4 }]);
    mockMemoryRecall.mockResolvedValue({
      messages: [
        { role: "user", content: "古い発言1", createdAt: new Date() },
        { role: "assistant", content: "古い発言2", createdAt: new Date() },
        { role: "user", content: "新規発言3", createdAt: new Date() },
        { role: "assistant", content: "新規発言4", createdAt: new Date() },
      ],
    });

    await extractAllPendingThreads(mockEnv);

    const prompt = mockGenerate.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("新規発言3");
    expect(prompt).toContain("新規発言4");
    expect(prompt).not.toContain("古い発言1");
    expect(prompt).not.toContain("古い発言2");
    expect(threadPersonaStatusRepository.upsert).toHaveBeenCalledWith(
      mockEnv.DB,
      expect.objectContaining({ threadId: "t1", lastMessageCount: 4 }),
    );
  });

  it("extraction_error 時は upsert せず次回再試行に回す", async () => {
    vi.mocked(threadPersonaStatusRepository.findAll).mockResolvedValue([]);
    mockAll
      .mockResolvedValueOnce([{ id: "t1", resourceId: "r1" }])
      .mockResolvedValueOnce([{ threadId: "t1", count: 2 }]);
    mockMemoryRecall.mockResolvedValue({
      messages: [
        { role: "user", content: "u1", createdAt: new Date() },
        { role: "assistant", content: "a1", createdAt: new Date() },
      ],
    });
    mockGenerate.mockRejectedValueOnce(new Error("boom"));

    const result = await extractAllPendingThreads(mockEnv);

    expect(result[0].result).toMatchObject({
      skipped: true,
      reason: "extraction_error",
    });
    expect(threadPersonaStatusRepository.upsert).not.toHaveBeenCalled();
  });
});
