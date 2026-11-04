import { beforeEach, describe, expect, it, vi } from "vitest";

const { workflowMock } = vi.hoisted(() => ({ workflowMock: vi.fn() }));

vi.mock("~/mastra/workflows/research-workflow", () => ({
  runResearch: workflowMock,
}));
vi.mock("~/mastra/request-context", () => ({
  createRequestContext: () => ({}),
}));
vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { runResearch } = await import("./research");

const env = {} as CloudflareBindings;

beforeEach(() => {
  workflowMock.mockReset();
});

describe("runResearch", () => {
  it("質問と観点をワークフローに渡し、調査メモをそのまま返す", async () => {
    workflowMock.mockResolvedValue({ memo: "確認できた事実\n- 8時発\n" });
    const aspects = [{ topic: "バスの時刻", queries: ["地域バス 時刻表"] }];
    const answer = await runResearch({ env, question: "バスの時間", aspects });
    expect(answer).toBe("確認できた事実\n- 8時発");
    expect(workflowMock).toHaveBeenCalledWith(
      expect.objectContaining({ input: { question: "バスの時間", aspects } }),
    );
  });

  it("観点が無ければ質問そのものを 1 観点にする", async () => {
    workflowMock.mockResolvedValue({ memo: "晴れ" });
    await runResearch({ env, question: "今日の天気" });
    expect(workflowMock.mock.calls[0]?.[0].input).toEqual({
      question: "今日の天気",
      aspects: [{ topic: "今日の天気", queries: ["今日の天気"] }],
    });
  });

  it("メモが空なら定型の失敗文を返す", async () => {
    workflowMock.mockResolvedValue({ memo: "  " });
    expect(await runResearch({ env, question: "q" })).toBe(
      "ごめんね、うまく調べられなかったみたい。",
    );
  });

  it("ワークフローが例外を投げても定型の失敗文を返す", async () => {
    workflowMock.mockRejectedValue(new Error("upstream"));
    expect(await runResearch({ env, question: "q" })).toBe(
      "ごめんね、うまく調べられなかったみたい。",
    );
  });
});
