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
  it("質問と観点を観点あたり 2 件の資料でワークフローに渡し、資料をそのまま返す", async () => {
    workflowMock.mockResolvedValue({ materials: "## 村の資料\n【1】8時発\n" });
    const aspects = [{ topic: "バスの時刻", queries: ["地域バス 時刻表"] }];
    const answer = await runResearch({ env, question: "バスの時間", aspects });
    expect(answer).toBe("## 村の資料\n【1】8時発");
    expect(workflowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { question: "バスの時間", aspects, chunksPerAspect: 2 },
      }),
    );
  });

  it("観点が無ければ質問そのものを 1 観点にする", async () => {
    workflowMock.mockResolvedValue({ materials: "晴れ" });
    await runResearch({ env, question: "今日の天気" });
    expect(workflowMock.mock.calls[0]?.[0].input).toEqual({
      question: "今日の天気",
      aspects: [{ topic: "今日の天気", queries: ["今日の天気"] }],
      chunksPerAspect: 2,
    });
  });

  it("資料が空なら定型の失敗文を返す", async () => {
    workflowMock.mockResolvedValue({ materials: "  " });
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
