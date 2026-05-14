import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDefined } from "~/__tests__/helpers/assert-defined";

vi.mock("~/repository/poll-repository", () => ({
  pollRepository: {
    findById: vi.fn(),
    findSubmission: vi.fn(),
    createSubmission: vi.fn(),
    findSubmissionsByPoll: vi.fn(),
  },
}));

const { mockReplyMessage, mockPushMessage, mockGenerateReply } = vi.hoisted(
  () => ({
    mockReplyMessage: vi.fn(),
    mockPushMessage: vi.fn(),
    mockGenerateReply: vi.fn(),
  }),
);

vi.mock("~/services/line-messaging", () => ({
  createLineClient: () => ({
    replyMessage: mockReplyMessage,
    pushMessage: mockPushMessage,
  }),
  generateReply: mockGenerateReply,
}));

const { pollRepository } = await import("~/repository/poll-repository");
const { handlePollPostback, getPollResults, generatePollFollowUp } =
  await import("./poll-response");

const env = {
  DB: {} as D1Database,
  LINE_CHANNEL_ACCESS_TOKEN: "token",
  WEB_URL: "https://web.example.com",
  RESOURCE_ID_HASH_SECRET: "test-secret",
} as unknown as CloudflareBindings;

const dbRow = {
  id: "p-1",
  title: "好きな季節",
  choices: JSON.stringify(["春", "夏", "秋", "冬"]),
  followUpPrompt: null,
  status: "sent" as const,
  createdBy: "u-1",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
  scheduledAt: null,
  sentAt: "2025-01-02T00:00:00Z",
  closedAt: null,
};

describe("handlePollPostback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReplyMessage.mockResolvedValue(undefined);
    mockPushMessage.mockResolvedValue(undefined);
  });

  it("postback data に poll / c が無ければ invalid", async () => {
    const result = await handlePollPostback(env, "U1", "broken=data", "rt");
    expect(result.status).toBe("invalid");
  });

  it("存在しない poll は invalid", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(null);
    vi.mocked(pollRepository.findSubmission).mockResolvedValue(null);

    const result = await handlePollPostback(
      env,
      "U1",
      "poll=missing&c=春",
      "rt",
    );
    expect(result.status).toBe("invalid");
  });

  it("draft / scheduled の poll は invalid", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue({
      ...dbRow,
      status: "draft",
    });
    vi.mocked(pollRepository.findSubmission).mockResolvedValue(null);

    const result = await handlePollPostback(env, "U1", "poll=p-1&c=春", "rt");
    expect(result.status).toBe("invalid");
  });

  it("選択肢が候補に無いと invalid", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
    vi.mocked(pollRepository.findSubmission).mockResolvedValue(null);

    const result = await handlePollPostback(
      env,
      "U1",
      "poll=p-1&c=未定義",
      "rt",
    );
    expect(result.status).toBe("invalid");
  });

  it("既回答ありなら already + 既存選択を返信", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
    vi.mocked(pollRepository.findSubmission).mockResolvedValue({
      id: "s-1",
      pollId: "p-1",
      userId: "U1",
      selectedChoice: "夏",
      createdAt: "2025-01-02T00:00:00Z",
    });

    const result = await handlePollPostback(env, "U1", "poll=p-1&c=春", "rt");

    expect(result.status).toBe("already");
    expect(pollRepository.createSubmission).not.toHaveBeenCalled();
    const reply = mockReplyMessage.mock.calls[0]?.[0];
    expect(reply.messages[0].text).toContain("夏");
  });

  it("初回回答は createSubmission + 完了 Flex を返す（answered）", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
    vi.mocked(pollRepository.findSubmission).mockResolvedValue(null);

    const result = await handlePollPostback(env, "U1", "poll=p-1&c=春", "rt");

    expect(result.status).toBe("answered");
    expect(pollRepository.createSubmission).toHaveBeenCalledWith(
      env.DB,
      expect.objectContaining({
        pollId: "p-1",
        userId: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        selectedChoice: "春",
      }),
    );
    const savedUserId = vi.mocked(pollRepository.createSubmission).mock
      .calls[0]?.[1].userId;
    expect(savedUserId).not.toBe("U1");
    const reply = mockReplyMessage.mock.calls[0]?.[0];
    expect(reply.messages[0].type).toBe("flex");
  });

  it("findSubmission にはハッシュ化済み userId が渡される", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
    vi.mocked(pollRepository.findSubmission).mockResolvedValue(null);

    await handlePollPostback(env, "U1", "poll=p-1&c=春", "rt");

    const firstCall = vi.mocked(pollRepository.findSubmission).mock.calls[0];
    assertDefined(firstCall);
    const [, , passedUserId] = firstCall;
    expect(passedUserId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(passedUserId).not.toBe("U1");
  });

  it("URL エンコードされた選択肢もデコードして処理", async () => {
    const encoded = encodeURIComponent("春 / 桜");
    vi.mocked(pollRepository.findById).mockResolvedValue({
      ...dbRow,
      choices: JSON.stringify(["春 / 桜", "夏"]),
    });
    vi.mocked(pollRepository.findSubmission).mockResolvedValue(null);

    const result = await handlePollPostback(
      env,
      "U1",
      `poll=p-1&c=${encoded}`,
      "rt",
    );

    expect(result.status).toBe("answered");
    expect(pollRepository.createSubmission).toHaveBeenCalledWith(
      env.DB,
      expect.objectContaining({ selectedChoice: "春 / 桜" }),
    );
  });
});

describe("getPollResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("存在しなければ null", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(null);
    expect(await getPollResults(env.DB, "p-1")).toBeNull();
  });

  it("各選択肢の件数 / パーセンテージを返す", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
    vi.mocked(pollRepository.findSubmissionsByPoll).mockResolvedValue([
      {
        id: "1",
        pollId: "p-1",
        userId: "u1",
        selectedChoice: "春",
        createdAt: "x",
      },
      {
        id: "2",
        pollId: "p-1",
        userId: "u2",
        selectedChoice: "春",
        createdAt: "x",
      },
      {
        id: "3",
        pollId: "p-1",
        userId: "u3",
        selectedChoice: "冬",
        createdAt: "x",
      },
    ]);

    const result = await getPollResults(env.DB, "p-1");

    expect(result?.totalSubmissions).toBe(3);
    expect(result?.choiceResults).toEqual([
      { choice: "春", count: 2, percentage: 67 },
      { choice: "夏", count: 0, percentage: 0 },
      { choice: "秋", count: 0, percentage: 0 },
      { choice: "冬", count: 1, percentage: 33 },
    ]);
  });

  it("回答ゼロでも全選択肢を 0% で返す", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
    vi.mocked(pollRepository.findSubmissionsByPoll).mockResolvedValue([]);

    const result = await getPollResults(env.DB, "p-1");

    expect(result?.totalSubmissions).toBe(0);
    expect(result?.choiceResults.every((c) => c.percentage === 0)).toBe(true);
  });

  it("候補外の choice が submission に紛れていても無視される", async () => {
    vi.mocked(pollRepository.findById).mockResolvedValue(dbRow);
    vi.mocked(pollRepository.findSubmissionsByPoll).mockResolvedValue([
      {
        id: "1",
        pollId: "p-1",
        userId: "u1",
        selectedChoice: "謎の選択肢",
        createdAt: "x",
      },
    ]);

    const result = await getPollResults(env.DB, "p-1");

    expect(result?.choiceResults.every((c) => c.count === 0)).toBe(true);
  });
});

describe("generatePollFollowUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPushMessage.mockResolvedValue(undefined);
  });

  it("generateReply の結果を pushMessage に転送", async () => {
    mockGenerateReply.mockResolvedValue(["返信1", "返信2"]);

    await generatePollFollowUp(
      env,
      "U1",
      { ...dbRow, choices: JSON.stringify(["春"]) },
      "春",
    );

    const arg = mockPushMessage.mock.calls[0]?.[0];
    expect(arg.to).toBe("U1");
    expect(arg.messages).toHaveLength(2);
  });

  it("返信が空配列なら pushMessage を呼ばない", async () => {
    mockGenerateReply.mockResolvedValue([]);

    await generatePollFollowUp(
      env,
      "U1",
      { ...dbRow, choices: JSON.stringify(["春"]) },
      "春",
    );

    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("generateReply が throw しても全体は throw しない", async () => {
    mockGenerateReply.mockRejectedValue(new Error("LLM error"));

    await expect(
      generatePollFollowUp(
        env,
        "U1",
        { ...dbRow, choices: JSON.stringify(["春"]) },
        "春",
      ),
    ).resolves.toBeUndefined();
  });
});
