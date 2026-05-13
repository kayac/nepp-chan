import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/poll-repository", () => ({
  pollRepository: {
    findSentSince: vi.fn(),
  },
}));

vi.mock("~/repository/user-poll-state-repository", () => ({
  userPollStateRepository: {
    findByUserId: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { pollRepository } = await import("~/repository/poll-repository");
const { userPollStateRepository } = await import(
  "~/repository/user-poll-state-repository"
);
const { buildPollSystemContent, injectPollsToThread } = await import(
  "./poll-thread-injector"
);

const fakeD1 = {} as D1Database;

const memoryStore = {
  getThreadById: vi.fn(),
  saveMessages: vi.fn(),
};
const storage = {
  getStore: vi.fn(),
} as unknown as Parameters<typeof injectPollsToThread>[0]["storage"];

beforeEach(() => {
  vi.mocked(pollRepository.findSentSince).mockReset();
  vi.mocked(userPollStateRepository.findByUserId).mockReset();
  vi.mocked(userPollStateRepository.upsert).mockReset();
  memoryStore.getThreadById.mockReset();
  memoryStore.saveMessages.mockReset();
  (storage.getStore as unknown as ReturnType<typeof vi.fn>) = vi
    .fn()
    .mockResolvedValue(memoryStore);
});

const buildPoll = (overrides: Partial<{ id: string; sentAt: string }>) => ({
  id: overrides.id ?? "p-1",
  title: "好きな色は？",
  choices: JSON.stringify(["赤", "青"]),
  followUpPrompt: null,
  status: "sent" as const,
  createdBy: "admin",
  createdAt: "2030-01-01T00:00:00Z",
  updatedAt: null,
  scheduledAt: null,
  sentAt: overrides.sentAt ?? "2030-01-10T12:00:00Z",
  closedAt: null,
});

describe("buildPollSystemContent", () => {
  it("followUpPrompt なしならヘッダーのみ", () => {
    const result = buildPollSystemContent(buildPoll({}));
    expect(result).toContain("【投票のお知らせ");
    expect(result).toContain("好きな色は？");
    expect(result).toContain("「赤」 / 「青」");
    expect(result).not.toContain("【内部メモ");
  });

  it("followUpPrompt ありなら内部メモブロックを付与", () => {
    const result = buildPollSystemContent({
      ...buildPoll({}),
      followUpPrompt: "なぜそれを選んだか聞いて",
    });
    expect(result).toContain("【内部メモ");
    expect(result).toContain("なぜそれを選んだか聞いて");
  });

  it("sentAt が null なら createdAt の日付を使う", () => {
    const result = buildPollSystemContent({
      ...buildPoll({}),
      sentAt: null,
      createdAt: "2030-03-15T00:00:00Z",
    });
    expect(result).toContain("（2030-03-15）");
  });
});

describe("injectPollsToThread", () => {
  it("memoryStore が無ければ何もしない", async () => {
    (storage.getStore as unknown as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockResolvedValue(null);

    await injectPollsToThread({
      d1: fakeD1,
      storage,
      threadId: "t-1",
      resourceId: "r",
      userId: "u",
    });

    expect(memoryStore.getThreadById).not.toHaveBeenCalled();
  });

  it("thread が無ければ何もしない", async () => {
    memoryStore.getThreadById.mockResolvedValueOnce(null);

    await injectPollsToThread({
      d1: fakeD1,
      storage,
      threadId: "t-1",
      resourceId: "r",
      userId: "u",
    });

    expect(pollRepository.findSentSince).not.toHaveBeenCalled();
  });

  it("初回（state なし）+ 0 件: 空振り state を upsert して終了", async () => {
    memoryStore.getThreadById.mockResolvedValueOnce({ id: "t-1" });
    vi.mocked(userPollStateRepository.findByUserId).mockResolvedValueOnce(null);
    vi.mocked(pollRepository.findSentSince).mockResolvedValueOnce([]);

    await injectPollsToThread({
      d1: fakeD1,
      storage,
      threadId: "t-1",
      resourceId: "r",
      userId: "u",
    });

    expect(userPollStateRepository.upsert).toHaveBeenCalledTimes(1);
    expect(memoryStore.saveMessages).not.toHaveBeenCalled();
  });

  it("継続（state あり）+ 0 件: upsert しない", async () => {
    memoryStore.getThreadById.mockResolvedValueOnce({ id: "t-1" });
    vi.mocked(userPollStateRepository.findByUserId).mockResolvedValueOnce({
      userId: "u",
      lastInjectedAt: "2030-01-01T00:00:00Z",
    });
    vi.mocked(pollRepository.findSentSince).mockResolvedValueOnce([]);

    await injectPollsToThread({
      d1: fakeD1,
      storage,
      threadId: "t-1",
      resourceId: "r",
      userId: "u",
    });

    expect(userPollStateRepository.upsert).not.toHaveBeenCalled();
  });

  it("polls あり: メッセージを saveMessages し最新 sentAt で upsert", async () => {
    memoryStore.getThreadById.mockResolvedValueOnce({ id: "t-1" });
    vi.mocked(userPollStateRepository.findByUserId).mockResolvedValueOnce(null);
    vi.mocked(pollRepository.findSentSince).mockResolvedValueOnce([
      buildPoll({ id: "p-1", sentAt: "2030-01-05T00:00:00Z" }),
      buildPoll({ id: "p-2", sentAt: "2030-01-10T00:00:00Z" }),
    ]);

    await injectPollsToThread({
      d1: fakeD1,
      storage,
      threadId: "t-1",
      resourceId: "r",
      userId: "u",
    });

    expect(memoryStore.saveMessages).toHaveBeenCalledTimes(1);
    const arg = memoryStore.saveMessages.mock.calls[0][0];
    expect(arg.messages).toHaveLength(2);
    expect(arg.messages[0].id).toBe("poll-inject:p-1:t-1");
    expect(arg.messages[0].role).toBe("system");

    expect(userPollStateRepository.upsert).toHaveBeenCalledWith(
      fakeD1,
      "u",
      "2030-01-10T00:00:00Z",
    );
  });
});
