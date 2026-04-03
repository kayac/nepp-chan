import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({}),
}));

const mockGetThreadById = vi.fn();

vi.mock("@mastra/memory", () => ({
  Memory: vi.fn().mockImplementation(() => ({
    getThreadById: mockGetThreadById,
  })),
}));

const { verifyThreadOwnership } = await import("~/services/thread");

describe("verifyThreadOwnership", () => {
  const mockDb = {} as D1Database;
  const threadId = "thread-123";
  const resourceId = "resource-abc";

  const mockThread = {
    id: threadId,
    resourceId,
    title: "テストスレッド",
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("所有者の resourceId で検証が通りスレッドを返す", async () => {
    mockGetThreadById.mockResolvedValue(mockThread);

    const result = await verifyThreadOwnership(threadId, resourceId, mockDb);

    expect(result).toEqual(mockThread);
  });

  it("存在しないスレッドで 404 をスローする", async () => {
    mockGetThreadById.mockResolvedValue(null);

    await expect(
      verifyThreadOwnership(threadId, resourceId, mockDb),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it("sessionResourceId がない場合に 401 をスローする", async () => {
    await expect(
      verifyThreadOwnership(threadId, undefined, mockDb),
    ).rejects.toMatchObject({
      status: 401,
    });

    // DB にアクセスしないことを確認
    expect(mockGetThreadById).not.toHaveBeenCalled();
  });

  it("resourceId が不一致の場合に 403 をスローする", async () => {
    mockGetThreadById.mockResolvedValue(mockThread);

    await expect(
      verifyThreadOwnership(threadId, "wrong-resource", mockDb),
    ).rejects.toMatchObject({
      status: 403,
    });
  });
});
