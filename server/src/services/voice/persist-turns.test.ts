import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveMessagesMock, saveThreadMock } = vi.hoisted(() => ({
  saveMessagesMock: vi.fn(),
  saveThreadMock: vi.fn(),
}));

vi.mock("~/lib/storage", () => ({
  getStorage: vi.fn().mockResolvedValue({
    getStore: vi.fn().mockResolvedValue({
      saveThread: saveThreadMock,
      saveMessages: saveMessagesMock,
    }),
  }),
}));

const { saveVoiceTurns } = await import("./persist-turns");

const base = {
  db: {} as D1Database,
  threadId: "voice-thread:abc",
  resourceId: "voice:def",
  createdAt: new Date("2026-10-28T00:00:00Z"),
  now: new Date("2026-10-28T00:10:00Z"),
};
const oneTurn = [{ turnIndex: 0, userText: "a", assistantText: "b" }];
const twoTurns = [
  { turnIndex: 0, userText: "a", assistantText: "b" },
  { turnIndex: 1, userText: "c", assistantText: "d" },
];
const save = (turns = oneTurn) => saveVoiceTurns({ ...base, turns });

beforeEach(() => {
  saveMessagesMock.mockReset();
  saveThreadMock.mockReset();
});

describe("saveVoiceTurns", () => {
  it("ターンごとに user/assistant の 2 メッセージを turnIndex 入りの ID で保存する", async () => {
    await save(twoTurns);
    const { messages } = saveMessagesMock.mock.calls[0][0];
    expect(messages.map((m: { id: string }) => m.id)).toEqual([
      "voice-thread:abc:turn:0:user",
      "voice-thread:abc:turn:0:assistant",
      "voice-thread:abc:turn:1:user",
      "voice-thread:abc:turn:1:assistant",
    ]);
    expect(saveThreadMock).toHaveBeenCalledWith({
      thread: expect.objectContaining({
        id: "voice-thread:abc",
        resourceId: "voice:def",
        title: "音声通話",
      }),
    });
  });

  it("createdAt は user → assistant → 次ターンの user の順に単調増加する", async () => {
    await save(twoTurns);
    const times = saveMessagesMock.mock.calls[0][0].messages.map(
      (m: { createdAt: Date }) => m.createdAt.getTime(),
    );
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(times.length);
  });

  it("保存に 1 回失敗したら同じ内容で 1 回だけやり直す", async () => {
    saveThreadMock.mockRejectedValueOnce(new Error("D1 busy"));
    await save();
    expect(saveThreadMock).toHaveBeenCalledTimes(2);
    expect(saveMessagesMock).toHaveBeenCalledTimes(1);
  });

  it("2 回目も失敗したら例外を投げる", async () => {
    saveThreadMock.mockRejectedValue(new Error("D1 down"));
    await expect(save()).rejects.toThrow("D1 down");
  });
});
