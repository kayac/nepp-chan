import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/broadcast-repository", () => ({
  broadcastRepository: {
    findSentSince: vi.fn(),
  },
}));

vi.mock("~/repository/user-broadcast-state-repository", () => ({
  userBroadcastStateRepository: {
    findByUserId: vi.fn(),
    upsert: vi.fn(),
  },
}));

const { broadcastRepository } = await import(
  "~/repository/broadcast-repository"
);
const { userBroadcastStateRepository } = await import(
  "~/repository/user-broadcast-state-repository"
);
const { injectBroadcastsToThread } = await import(
  "./broadcast-thread-injector"
);

const memoryStoreApi = {
  getThreadById: vi.fn(),
  saveMessages: vi.fn(),
};
const storage = {
  getStore: vi.fn().mockResolvedValue(memoryStoreApi),
};

const fakeD1 = {} as D1Database;

const buildBroadcast = (overrides: { id: string; sentAt: string }) => ({
  id: overrides.id,
  title: "おしらせ",
  body: "本文です",
  parts: null,
  status: "sent",
  scheduledAt: null,
  sentAt: overrides.sentAt,
  errorMessage: null,
  createdBy: "u",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
});

describe("injectBroadcastsToThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getStore.mockResolvedValue(memoryStoreApi);
  });

  it("memory store が無ければ何もしない", async () => {
    storage.getStore.mockResolvedValueOnce(null);

    await injectBroadcastsToThread({
      d1: fakeD1,
      // biome-ignore lint/suspicious/noExplicitAny: テスト用の最小スタブ
      storage: storage as any,
      threadId: "t-1",
      resourceId: "r-1",
      userId: "u-1",
    });

    expect(broadcastRepository.findSentSince).not.toHaveBeenCalled();
  });

  it("スレッドが無ければ何もしない", async () => {
    memoryStoreApi.getThreadById.mockResolvedValue(null);

    await injectBroadcastsToThread({
      d1: fakeD1,
      // biome-ignore lint/suspicious/noExplicitAny: テスト用の最小スタブ
      storage: storage as any,
      threadId: "t-1",
      resourceId: "r-1",
      userId: "u-1",
    });

    expect(broadcastRepository.findSentSince).not.toHaveBeenCalled();
  });

  it("初回（state なし）は 7 日前を since にする", async () => {
    memoryStoreApi.getThreadById.mockResolvedValue({ id: "t-1" });
    vi.mocked(userBroadcastStateRepository.findByUserId).mockResolvedValue(
      null,
    );
    vi.mocked(broadcastRepository.findSentSince).mockResolvedValue([]);

    const before = Date.now();
    await injectBroadcastsToThread({
      d1: fakeD1,
      // biome-ignore lint/suspicious/noExplicitAny: テスト用の最小スタブ
      storage: storage as any,
      threadId: "t-1",
      resourceId: "r-1",
      userId: "u-1",
    });

    const sinceArg = vi.mocked(broadcastRepository.findSentSince).mock
      .calls[0]?.[1] as string;
    const sinceMs = new Date(sinceArg).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(before - sinceMs).toBeGreaterThanOrEqual(sevenDays - 1000);
    expect(before - sinceMs).toBeLessThanOrEqual(sevenDays + 5000);
  });

  it("state あれば lastInjectedAt を since にする", async () => {
    memoryStoreApi.getThreadById.mockResolvedValue({ id: "t-1" });
    vi.mocked(userBroadcastStateRepository.findByUserId).mockResolvedValue({
      userId: "u-1",
      lastInjectedAt: "2025-06-01T00:00:00Z",
    });
    vi.mocked(broadcastRepository.findSentSince).mockResolvedValue([]);

    await injectBroadcastsToThread({
      d1: fakeD1,
      // biome-ignore lint/suspicious/noExplicitAny: テスト用の最小スタブ
      storage: storage as any,
      threadId: "t-1",
      resourceId: "r-1",
      userId: "u-1",
    });

    expect(broadcastRepository.findSentSince).toHaveBeenCalledWith(
      fakeD1,
      "2025-06-01T00:00:00Z",
    );
  });

  it("配信なしなら saveMessages を呼ばず upsert もしない", async () => {
    memoryStoreApi.getThreadById.mockResolvedValue({ id: "t-1" });
    vi.mocked(userBroadcastStateRepository.findByUserId).mockResolvedValue({
      userId: "u-1",
      lastInjectedAt: "2025-06-01T00:00:00Z",
    });
    vi.mocked(broadcastRepository.findSentSince).mockResolvedValue([]);

    await injectBroadcastsToThread({
      d1: fakeD1,
      // biome-ignore lint/suspicious/noExplicitAny: テスト用の最小スタブ
      storage: storage as any,
      threadId: "t-1",
      resourceId: "r-1",
      userId: "u-1",
    });

    expect(memoryStoreApi.saveMessages).not.toHaveBeenCalled();
    expect(userBroadcastStateRepository.upsert).not.toHaveBeenCalled();
  });

  it("配信あれば system messages を作って保存し、最後の sentAt で state を更新", async () => {
    memoryStoreApi.getThreadById.mockResolvedValue({ id: "t-1" });
    vi.mocked(userBroadcastStateRepository.findByUserId).mockResolvedValue({
      userId: "u-1",
      lastInjectedAt: "2025-01-01T00:00:00Z",
    });
    vi.mocked(broadcastRepository.findSentSince).mockResolvedValue([
      buildBroadcast({ id: "b-1", sentAt: "2025-01-02T00:00:00Z" }),
      buildBroadcast({ id: "b-2", sentAt: "2025-01-03T00:00:00Z" }),
    ]);

    await injectBroadcastsToThread({
      d1: fakeD1,
      // biome-ignore lint/suspicious/noExplicitAny: テスト用の最小スタブ
      storage: storage as any,
      threadId: "t-1",
      resourceId: "r-1",
      userId: "u-1",
    });

    const saveArg = memoryStoreApi.saveMessages.mock.calls[0]?.[0];
    expect(saveArg.messages).toHaveLength(2);
    expect(saveArg.messages[0]).toMatchObject({
      role: "system",
      threadId: "t-1",
      resourceId: "r-1",
    });

    expect(userBroadcastStateRepository.upsert).toHaveBeenCalledWith(
      fakeD1,
      "u-1",
      "2025-01-03T00:00:00Z",
    );
  });

  it("system message の text は title / 日付を含む", async () => {
    memoryStoreApi.getThreadById.mockResolvedValue({ id: "t-1" });
    vi.mocked(userBroadcastStateRepository.findByUserId).mockResolvedValue(
      null,
    );
    vi.mocked(broadcastRepository.findSentSince).mockResolvedValue([
      buildBroadcast({ id: "b-1", sentAt: "2025-01-15T00:00:00Z" }),
    ]);

    await injectBroadcastsToThread({
      d1: fakeD1,
      // biome-ignore lint/suspicious/noExplicitAny: テスト用の最小スタブ
      storage: storage as any,
      threadId: "t-1",
      resourceId: "r-1",
      userId: "u-1",
    });

    const saveArg = memoryStoreApi.saveMessages.mock.calls[0]?.[0];
    const text = saveArg.messages[0].content.parts[0].text;
    expect(text).toContain("2025-01-15");
    expect(text).toContain("おしらせ");
  });
});
