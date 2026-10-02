import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { feedbackRepository } from "~/repository/feedback-repository";
import { mastraMessageRepository } from "~/repository/mastra-message-repository";
import { mastraThreadRepository } from "~/repository/mastra-thread-repository";
import { threadPersonaStatusRepository } from "~/repository/thread-persona-status-repository";
import { deleteThreadWithRelatedData } from "./thread";

// モック
vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({}),
}));

const mockGetThreadById = vi.fn();
const mockDeleteThread = vi.fn();

vi.mock("@mastra/memory", () => ({
  Memory: vi.fn(function () {
    return {
      getThreadById: mockGetThreadById,
      deleteThread: mockDeleteThread,
    };
  }),
}));

vi.mock("~/repository/feedback-repository", () => ({
  feedbackRepository: {
    deleteByThreadId: vi.fn(),
  },
}));

vi.mock("~/repository/thread-persona-status-repository", () => ({
  threadPersonaStatusRepository: {
    deleteWithDelegatedByThreadId: vi.fn(),
  },
}));

vi.mock("~/repository/mastra-message-repository", () => ({
  mastraMessageRepository: {
    deleteWithDelegatedByThreadId: vi.fn(),
  },
}));

vi.mock("~/repository/mastra-thread-repository", () => ({
  mastraThreadRepository: {
    deleteWithDelegatedById: vi.fn(),
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
    vi.mocked(feedbackRepository.deleteByThreadId).mockResolvedValue(0);
    mockDeleteThread.mockResolvedValue(undefined);

    await deleteThreadWithRelatedData(threadId, mockDb);

    expect(feedbackRepository.deleteByThreadId).toHaveBeenCalledWith(
      mockDb,
      threadId,
    );
    expect(mockDeleteThread).toHaveBeenCalledWith(threadId);
  });

  it("委譲先のサブエージェントのスレッド・メッセージ・抽出状態も削除する", async () => {
    mockGetThreadById.mockResolvedValue({ id: threadId });

    await deleteThreadWithRelatedData(threadId, mockDb);

    expect(
      threadPersonaStatusRepository.deleteWithDelegatedByThreadId,
    ).toHaveBeenCalledWith(mockDb, threadId);
    expect(
      mastraMessageRepository.deleteWithDelegatedByThreadId,
    ).toHaveBeenCalledWith(mockDb, threadId);
    expect(mastraThreadRepository.deleteWithDelegatedById).toHaveBeenCalledWith(
      mockDb,
      threadId,
    );
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
    expect(
      threadPersonaStatusRepository.deleteWithDelegatedByThreadId,
    ).not.toHaveBeenCalled();
    expect(
      mastraThreadRepository.deleteWithDelegatedById,
    ).not.toHaveBeenCalled();
    expect(mockDeleteThread).not.toHaveBeenCalled();
  });
});
