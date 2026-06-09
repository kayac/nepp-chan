import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/repository/poll-repository", () => ({
  pollRepository: {
    create: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("~/services/poll-delivery", () => ({
  sendPoll: vi.fn(),
}));

const { pollRepository } = await import("~/repository/poll-repository");
const { sendPoll } = await import("~/services/poll-delivery");
const { createPoll, updatePoll, formatPollResponse, getPoll } = await import(
  "./poll"
);

const env = { DB: {} as D1Database } as unknown as CloudflareBindings;

const dbRow = {
  id: "p-1",
  title: "好きな季節",
  choices: JSON.stringify(["春", "夏", "秋", "冬"]),
  followUpPrompt: null,
  status: "draft" as const,
  createdBy: "u-1",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
  scheduledAt: null,
  sentAt: null,
  closedAt: null,
};

describe("formatPollResponse", () => {
  it("choices を JSON.parse して返す", () => {
    const result = formatPollResponse(dbRow);
    expect(result.choices).toEqual(["春", "夏", "秋", "冬"]);
  });
});

describe("getPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("該当なしは null", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(null);

    expect(await getPoll(env.DB, "missing")).toBeNull();
  });

  it("該当ありは formatPollResponse 結果を返す", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);

    const result = await getPoll(env.DB, "p-1");
    expect(result?.choices).toEqual(["春", "夏", "秋", "冬"]);
  });
});

describe("createPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
  });

  it("scheduledAt なし → status=draft で作成", async () => {
    await createPoll(env, {
      title: "x",
      choices: ["a", "b"],
      createdBy: "u-1",
    });

    expect(pollRepository.create).toHaveBeenCalledWith(
      env.DB,
      expect.objectContaining({ status: "draft" }),
    );
  });

  it("scheduledAt あり → status=scheduled", async () => {
    await createPoll(env, {
      title: "x",
      choices: ["a", "b"],
      scheduledAt: "2025-12-01T00:00:00Z",
      createdBy: "u-1",
    });

    expect(pollRepository.create).toHaveBeenCalledWith(
      env.DB,
      expect.objectContaining({ status: "scheduled" }),
    );
  });

  it("choices は JSON 文字列で永続化", async () => {
    await createPoll(env, {
      title: "x",
      choices: ["a", "b"],
      createdBy: "u-1",
    });

    const arg = vi.mocked(pollRepository.create).mock.calls[0]?.[1];
    expect(arg?.choices).toBe(JSON.stringify(["a", "b"]));
  });

  it("followUpPrompt が空白のみなら null で保存", async () => {
    await createPoll(env, {
      title: "x",
      choices: ["a", "b"],
      followUpPrompt: "   ",
      createdBy: "u-1",
    });

    const arg = vi.mocked(pollRepository.create).mock.calls[0]?.[1];
    expect(arg?.followUpPrompt).toBeNull();
  });

  it("sendNow=true で sendPoll を呼ぶ", async () => {
    vi.mocked(sendPoll).mockResolvedValue({ success: true });

    await createPoll(env, {
      title: "x",
      choices: ["a", "b"],
      sendNow: true,
      createdBy: "u-1",
    });

    expect(sendPoll).toHaveBeenCalled();
  });

  it("sendNow=true で送信失敗なら throw", async () => {
    vi.mocked(sendPoll).mockResolvedValue({ success: false, error: "fail" });

    await expect(
      createPoll(env, {
        title: "x",
        choices: ["a", "b"],
        sendNow: true,
        createdBy: "u-1",
      }),
    ).rejects.toThrow("fail");
  });
});

describe("updatePoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
  });

  it("変更なし（空 input）でも update を呼ばない", async () => {
    await updatePoll(env.DB, "p-1", {});

    expect(pollRepository.update).not.toHaveBeenCalled();
  });

  it("title だけ更新", async () => {
    await updatePoll(env.DB, "p-1", { title: "新タイトル" });

    expect(pollRepository.update).toHaveBeenCalledWith(env.DB, "p-1", {
      title: "新タイトル",
    });
  });

  it("choices は JSON 文字列で渡す", async () => {
    await updatePoll(env.DB, "p-1", { choices: ["A", "B"] });

    expect(pollRepository.update).toHaveBeenCalledWith(env.DB, "p-1", {
      choices: JSON.stringify(["A", "B"]),
    });
  });

  it("followUpPrompt = null で明示的に null を保存", async () => {
    await updatePoll(env.DB, "p-1", { followUpPrompt: null });

    expect(pollRepository.update).toHaveBeenCalledWith(env.DB, "p-1", {
      followUpPrompt: null,
    });
  });

  it("followUpPrompt = '   ' （空白のみ）も null", async () => {
    await updatePoll(env.DB, "p-1", { followUpPrompt: "   " });

    expect(pollRepository.update).toHaveBeenCalledWith(env.DB, "p-1", {
      followUpPrompt: null,
    });
  });
});
