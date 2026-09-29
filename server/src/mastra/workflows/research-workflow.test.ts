import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { knowledgeGenerate, webGenerate, askJevMock, searchMock } = vi.hoisted(
  () => ({
    knowledgeGenerate: vi.fn(),
    webGenerate: vi.fn(),
    askJevMock: vi.fn(),
    searchMock: vi.fn(),
  }),
);

vi.mock("~/services/knowledge/search", () => ({
  searchKnowledge: searchMock,
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

const vectorize = {} as VectorizeIndex;

const contextWithKey = (key?: string, withSearch = true) => {
  const ctx = new RequestContext();
  ctx.set("env", {
    TYPESAFE_API_KEY: key,
    ...(withSearch && {
      VECTORIZE: vectorize,
      GOOGLE_GENERATIVE_AI_API_KEY: "g",
    }),
  });
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
  searchMock.mockReset();
  searchMock.mockResolvedValue({ results: [] });
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
      steps: [],
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
      steps: [],
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
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      text: "メモ\n判定: 取れた",
    });

    await runResearch({ question: "q", requestContext: contextWithKey("k") });

    expect(knowledgeGenerate).toHaveBeenCalledTimes(1);
  });

  it("TYPESAFE_API_KEY が無ければ jev を呼ばず村のこととして扱う", async () => {
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      text: "メモ\n判定: 取れた",
    });

    await runResearch({ question: "q", requestContext: contextWithKey() });

    expect(askJevMock).not.toHaveBeenCalled();
    expect(knowledgeGenerate).toHaveBeenCalledTimes(1);
  });

  it("jev が失敗したら村のこととして扱う", async () => {
    askJevMock.mockRejectedValueOnce(new Error("jev responded 429"));
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      text: "メモ\n判定: 取れた",
    });

    await runResearch({ question: "q", requestContext: contextWithKey("k") });

    expect(knowledgeGenerate).toHaveBeenCalledTimes(1);
  });

  it("村のことなら、質問そのままで先に検索し、結果をナレッジ用エージェントに渡す", async () => {
    askJevMock.mockResolvedValueOnce(routeResponse(0.9));
    searchMock.mockResolvedValueOnce({
      results: [
        {
          content: "寮費は月額30,000円",
          score: 0.9,
          source: "official/otoko/qa.md",
          title: "おと高Q&A",
          url: "https://example.com/qa",
        },
      ],
    });
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      text: "メモ\n判定: 取れた",
    });
    const ctx = contextWithKey("k");

    await runResearch({ question: "寮費は？", requestContext: ctx });

    expect(searchMock).toHaveBeenCalledWith("寮費は？", vectorize, "g", ctx);
    const prompt = knowledgeGenerate.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("寮費は月額30,000円");
    expect(prompt).toContain("おと高Q&A");
    expect(prompt).toContain("https://example.com/qa");
  });

  it("検索語が渡されたら、検索語ごとに並列で先に検索し、同じ資料は 1 回だけ渡す", async () => {
    askJevMock.mockResolvedValueOnce(routeResponse(0.9));
    const shared = {
      content: "出生祝金は3万円",
      score: 0.9,
      source: "official/kosodate.md",
    };
    searchMock
      .mockResolvedValueOnce({ results: [shared] })
      .mockResolvedValueOnce({
        results: [
          shared,
          {
            content: "児童手当は認定請求が必要",
            score: 0.8,
            source: "official/jidou.md",
          },
        ],
      });
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      text: "メモ\n判定: 取れた",
    });
    const ctx = contextWithKey("k");

    await runResearch({
      question: "子供が生まれました。村の支援制度はありますか？",
      queries: ["出生祝金", "児童手当"],
      requestContext: ctx,
    });

    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock).toHaveBeenCalledWith("出生祝金", vectorize, "g", ctx);
    expect(searchMock).toHaveBeenCalledWith("児童手当", vectorize, "g", ctx);
    const prompt = knowledgeGenerate.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("子供が生まれました。村の支援制度はありますか？");
    expect(prompt.match(/出生祝金は3万円/g)).toHaveLength(1);
    expect(prompt).toContain("児童手当は認定請求が必要");
  });

  it("検索語が空なら質問そのままで検索する", async () => {
    askJevMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      text: "メモ\n判定: 取れた",
    });
    const ctx = contextWithKey("k");

    await runResearch({
      question: "寮費は？",
      queries: [],
      requestContext: ctx,
    });

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledWith("寮費は？", vectorize, "g", ctx);
  });

  it("判定が箇条書きの 1 行でも読み取り、メモから取り除く", async () => {
    askJevMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      text: "- 寮費は月額30,000円\n- 判定: 取れた",
    });

    const result = await runResearch({
      question: "寮費は？",
      requestContext: contextWithKey("k"),
    });

    expect(webGenerate).not.toHaveBeenCalled();
    expect(result.memo).toContain("- 寮費は月額30,000円");
    expect(result.memo).not.toMatch(/\n-\s*$/);
  });

  it("Vectorize が使えなければ先の検索を飛ばし、ナレッジ用エージェントに任せる", async () => {
    askJevMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      text: "メモ\n判定: 取れた",
    });

    await runResearch({
      question: "q",
      requestContext: contextWithKey("k", false),
    });

    expect(searchMock).not.toHaveBeenCalled();
    expect(knowledgeGenerate).toHaveBeenCalledTimes(1);
  });

  it("先の検索が失敗したら、検索結果を渡さずナレッジ用エージェントに任せる", async () => {
    askJevMock.mockResolvedValueOnce(routeResponse(0.9));
    searchMock.mockResolvedValueOnce({ results: [], error: "vectorize 500" });
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      text: "メモ\n判定: 取れた",
    });

    await runResearch({ question: "q", requestContext: contextWithKey("k") });

    expect(knowledgeGenerate.mock.calls[0]?.[0]).not.toContain(
      "最初の検索結果",
    );
  });

  it("村外なら先の検索もしない", async () => {
    askJevMock.mockResolvedValueOnce(routeResponse(0.1));
    webGenerate.mockResolvedValueOnce({ text: "明日は雪" });

    await runResearch({
      question: "明日の天気は？",
      requestContext: contextWithKey("k"),
    });

    expect(searchMock).not.toHaveBeenCalled();
  });

  it("エージェントに requestContext をそのまま渡す", async () => {
    askJevMock.mockResolvedValueOnce(routeResponse(0.9));
    knowledgeGenerate.mockResolvedValueOnce({
      steps: [],
      text: "メモ\n判定: 一部",
    });
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
