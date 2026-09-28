import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { knowledgeGenerate, webGenerate, askJevMock } = vi.hoisted(() => ({
  knowledgeGenerate: vi.fn(),
  webGenerate: vi.fn(),
  askJevMock: vi.fn(),
}));

vi.mock("~/mastra/agents/knowledge-agent", () => ({
  knowledgeAgent: { generate: knowledgeGenerate },
}));

vi.mock("~/mastra/agents/web-researcher-agent", () => ({
  webResearcherAgent: { generate: webGenerate },
}));

vi.mock("~/services/analytics/llm-usage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/services/analytics/llm-usage")>()),
  askJevWithUsage: askJevMock,
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { parseCoverage, runResearch } = await import("./research-workflow");

const contextWithKey = (key?: string) => {
  const ctx = new RequestContext();
  ctx.set("env", { TYPESAFE_API_KEY: key });
  return ctx;
};

const routeResponse = (village: number) => ({
  model: "jev-1.13.0",
  answers: {
    route: {
      type: "choice" as const,
      choice: village >= 0.5 ? "village" : "outside",
      probabilities: { village, outside: 1 - village },
    },
  },
});

beforeEach(() => {
  knowledgeGenerate.mockReset();
  webGenerate.mockReset();
  askJevMock.mockReset();
});

describe("parseCoverage", () => {
  it.each([
    ["調査メモ\n判定: 取れた", "取れた"],
    ["調査メモ\n判定：一部", "一部"],
    ["判定: 取れない", "取れない"],
  ])("「%s」から %s を読む", (memo, expected) => {
    expect(parseCoverage(memo)).toBe(expected);
  });

  it("判定行が無ければ一部として扱う", () => {
    expect(parseCoverage("調査メモだけ")).toBe("一部");
  });
});

describe("runResearch", () => {
  it("村のことで取れたなら、ナレッジだけで調査メモを返す", async () => {
    askJevMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      text: "寮費は月額30,000円\n判定: 取れた",
    });

    const result = await runResearch({
      question: "寮費は？",
      requestContext: contextWithKey("k"),
    });

    expect(webGenerate).not.toHaveBeenCalled();
    expect(result.memo).toContain("寮費は月額30,000円");
    expect(result.memo).not.toContain("判定:");
  });

  it("村のことで一部だけなら、確認済みの内容を添えて Web に足りない点を頼む", async () => {
    askJevMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      text: "和室は2室\n判定: 一部",
    });
    webGenerate.mockResolvedValueOnce({ text: "料金は1時間500円" });

    const result = await runResearch({
      question: "和室を借りたい",
      requestContext: contextWithKey("k"),
    });

    expect(webGenerate.mock.calls[0]?.[0]).toContain("和室は2室");
    expect(result.memo).toContain("和室は2室");
    expect(result.memo).toContain("料金は1時間500円");
  });

  it("村外・時事なら、ナレッジを使わず Web だけで調べる", async () => {
    askJevMock.mockResolvedValueOnce(routeResponse(0.1));
    webGenerate.mockResolvedValueOnce({ text: "明日は雪" });

    const result = await runResearch({
      question: "明日の天気は？",
      requestContext: contextWithKey("k"),
    });

    expect(knowledgeGenerate).not.toHaveBeenCalled();
    expect(result.memo).toContain("明日は雪");
  });

  it("P(village) が 0.3 以上なら村のこととして扱う", async () => {
    askJevMock.mockResolvedValueOnce(routeResponse(0.3));
    knowledgeGenerate.mockResolvedValueOnce({ text: "メモ\n判定: 取れた" });

    await runResearch({ question: "q", requestContext: contextWithKey("k") });

    expect(knowledgeGenerate).toHaveBeenCalledTimes(1);
  });

  it("TYPESAFE_API_KEY が無ければ jev を呼ばず村のこととして扱う", async () => {
    knowledgeGenerate.mockResolvedValueOnce({ text: "メモ\n判定: 取れた" });

    await runResearch({ question: "q", requestContext: contextWithKey() });

    expect(askJevMock).not.toHaveBeenCalled();
    expect(knowledgeGenerate).toHaveBeenCalledTimes(1);
  });

  it("jev が失敗したら村のこととして扱う", async () => {
    askJevMock.mockRejectedValueOnce(new Error("jev responded 429"));
    knowledgeGenerate.mockResolvedValueOnce({ text: "メモ\n判定: 取れた" });

    await runResearch({ question: "q", requestContext: contextWithKey("k") });

    expect(knowledgeGenerate).toHaveBeenCalledTimes(1);
  });

  it("エージェントに requestContext をそのまま渡す", async () => {
    askJevMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({ text: "メモ\n判定: 一部" });
    webGenerate.mockResolvedValueOnce({ text: "補足" });
    const ctx = contextWithKey("k");

    await runResearch({ question: "q", requestContext: ctx });

    expect(knowledgeGenerate.mock.calls[0]?.[1]).toMatchObject({
      requestContext: ctx,
    });
    expect(webGenerate.mock.calls[0]?.[1]).toMatchObject({
      requestContext: ctx,
    });
  });
});
