import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateMock, askJevMock } = vi.hoisted(() => ({
  generateMock: vi.fn(),
  askJevMock: vi.fn(),
}));

vi.mock("@mastra/core/agent", () => ({
  Agent: class {
    generate = generateMock;
  },
}));

vi.mock("~/lib/jev", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/jev")>()),
  askJev: askJevMock,
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { createRerankScorer } = await import("./rerank-scorer");

const contextWithKey = (key?: string) => {
  const ctx = new RequestContext();
  ctx.set("env", { TYPESAFE_API_KEY: key });
  return ctx;
};

const jevResponse = (noul: number) => ({
  model: "jev-1.13.0",
  answers: { relevant: { type: "noul" as const, noul } },
  usage: { input_tokens: 680, output_tokens: 0 },
});

beforeEach(() => {
  generateMock.mockReset();
  askJevMock.mockReset();
});

describe("createRerankScorer（jev）", () => {
  it("jev の noul をそのまま関連度として返し、luna を呼ばない", async () => {
    askJevMock.mockResolvedValueOnce(jevResponse(0.82));
    const scorer = createRerankScorer(contextWithKey("k"));
    expect(await scorer.getRelevanceScore("寮費は？", "月額30,000円")).toBe(
      0.82,
    );
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("query と passage を state に、noul 1 問を questions に渡す", async () => {
    askJevMock.mockResolvedValueOnce(jevResponse(0.5));
    await createRerankScorer(contextWithKey("secret")).getRelevanceScore(
      "寮費は？",
      "月額30,000円",
    );
    const params = askJevMock.mock.calls[0]?.[0];
    expect(params.apiKey).toBe("secret");
    expect(params.state).toEqual({
      query: "寮費は？",
      passage: "月額30,000円",
    });
    expect(params.questions.relevant.type).toBe("noul");
  });
});

describe("createRerankScorer（luna フォールバック）", () => {
  it("TYPESAFE_API_KEY が無ければ jev を呼ばず luna の数値を返す", async () => {
    generateMock.mockResolvedValueOnce({ text: "0.7" });
    expect(
      await createRerankScorer(contextWithKey()).getRelevanceScore("q", "p"),
    ).toBe(0.7);
    expect(askJevMock).not.toHaveBeenCalled();
  });

  it("requestContext が無ければ luna で採点する", async () => {
    generateMock.mockResolvedValueOnce({ text: "0.4" });
    expect(await createRerankScorer().getRelevanceScore("q", "p")).toBe(0.4);
    expect(askJevMock).not.toHaveBeenCalled();
  });

  it("jev が throw したらその passage だけ luna で採点する", async () => {
    askJevMock.mockRejectedValueOnce(new Error("jev responded 429"));
    generateMock.mockResolvedValueOnce({ text: "0.6" });
    const ctx = contextWithKey("k");
    expect(
      await createRerankScorer(ctx).getRelevanceScore("q", "passage text"),
    ).toBe(0.6);
    expect(generateMock).toHaveBeenCalledWith(
      expect.stringContaining("passage text"),
      expect.objectContaining({ requestContext: ctx }),
    );
  });

  it("jev の answer が noul でなければ luna に落ちる", async () => {
    askJevMock.mockResolvedValueOnce({
      answers: { relevant: { type: "score", score: 1 } },
    });
    generateMock.mockResolvedValueOnce({ text: "0.3" });
    expect(
      await createRerankScorer(contextWithKey("k")).getRelevanceScore("q", "p"),
    ).toBe(0.3);
  });
});
