import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { feedbackRepository } from "~/repository/feedback-repository";
import { threadPersonaStatusRepository } from "~/repository/thread-persona-status-repository";
import { deleteThreadWithRelatedData } from "~/services/thread";

// モック
vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({}),
}));

const mockGetThreadById = vi.fn();
const mockDeleteThread = vi.fn();

vi.mock("@mastra/memory", () => ({
  Memory: vi.fn().mockImplementation(() => ({
    getThreadById: mockGetThreadById,
    deleteThread: mockDeleteThread,
  })),
}));

vi.mock("~/repository/feedback-repository", () => ({
  feedbackRepository: {
    deleteByThreadId: vi.fn(),
  },
}));

vi.mock("~/repository/thread-persona-status-repository", () => ({
  threadPersonaStatusRepository: {
    delete: vi.fn(),
  },
}));

describe("deleteThreadWithRelatedData", () => {
  const mockDb = {} as D1Database;
  const threadId = "thread-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("存在するスレッドの関連データを全て削除できる", async () => {
    mockGetThreadById.mockResolvedValue({ id: threadId });
    vi.mocked(feedbackRepository.deleteByThreadId).mockResolvedValue({
      success: true,
    });
    vi.mocked(threadPersonaStatusRepository.delete).mockResolvedValue({
      success: true,
    });
    mockDeleteThread.mockResolvedValue(undefined);

    await deleteThreadWithRelatedData(threadId, mockDb);

    expect(feedbackRepository.deleteByThreadId).toHaveBeenCalledWith(
      mockDb,
      threadId,
    );
    expect(threadPersonaStatusRepository.delete).toHaveBeenCalledWith(
      mockDb,
      threadId,
    );
    expect(mockDeleteThread).toHaveBeenCalledWith(threadId);
  });

  it("feedback → personaStatus → thread の順に削除される", async () => {
    const callOrder: string[] = [];

    mockGetThreadById.mockResolvedValue({ id: threadId });
    vi.mocked(feedbackRepository.deleteByThreadId).mockImplementation(
      async () => {
        callOrder.push("feedback");
        return { success: true };
      },
    );
    vi.mocked(threadPersonaStatusRepository.delete).mockImplementation(
      async () => {
        callOrder.push("personaStatus");
        return { success: true };
      },
    );
    mockDeleteThread.mockImplementation(async () => {
      callOrder.push("thread");
    });

    await deleteThreadWithRelatedData(threadId, mockDb);

    expect(callOrder).toEqual(["feedback", "personaStatus", "thread"]);
  });

  it("存在しないスレッドで HTTPException(404) をスローする", async () => {
    mockGetThreadById.mockResolvedValue(null);

    await expect(deleteThreadWithRelatedData(threadId, mockDb)).rejects.toThrow(
      HTTPException,
    );

    await expect(
      deleteThreadWithRelatedData(threadId, mockDb),
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(feedbackRepository.deleteByThreadId).not.toHaveBeenCalled();
    expect(threadPersonaStatusRepository.delete).not.toHaveBeenCalled();
    expect(mockDeleteThread).not.toHaveBeenCalled();
  });
});
