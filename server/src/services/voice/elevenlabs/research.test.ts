import { beforeEach, describe, expect, it, vi } from "vitest";

const { researchMock } = vi.hoisted(() => ({ researchMock: vi.fn() }));

vi.mock("~/services/research", () => ({
  research: researchMock,
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
  researchMock.mockReset();
});

describe("runResearch", () => {
  it("質問と観点を観点あたり 2 件の資料で検索に渡し、資料をそのまま返す", async () => {
    researchMock.mockResolvedValue("## 村の資料\n【1】8時発\n");
    const aspects = [{ topic: "バスの時刻", queries: ["地域バス 時刻表"] }];
    const answer = await runResearch({ env, question: "バスの時間", aspects });
    expect(answer).toBe("## 村の資料\n【1】8時発");
    expect(researchMock.mock.calls[0]?.[0]).toEqual({
      question: "バスの時間",
      aspects,
    });
    expect(researchMock.mock.calls[0]?.[1]).toMatchObject({
      chunksPerAspect: 2,
    });
  });

  it("観点が無ければ質問そのものを 1 観点にする", async () => {
    researchMock.mockResolvedValue("晴れ");
    await runResearch({ env, question: "今日の天気" });
    expect(researchMock.mock.calls[0]?.[0]).toEqual({
      question: "今日の天気",
      aspects: [{ topic: "今日の天気", queries: ["今日の天気"] }],
    });
  });

  it("資料が空なら定型の失敗文を返す", async () => {
    researchMock.mockResolvedValue("  ");
    expect(await runResearch({ env, question: "q" })).toBe(
      "ごめんね、うまく調べられなかったみたい。",
    );
  });

  it("検索が例外を投げても定型の失敗文を返す", async () => {
    researchMock.mockRejectedValue(new Error("upstream"));
    expect(await runResearch({ env, question: "q" })).toBe(
      "ごめんね、うまく調べられなかったみたい。",
    );
  });
});
