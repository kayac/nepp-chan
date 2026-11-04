import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateMock, askJevMock } = vi.hoisted(() => ({
  generateMock: vi.fn(),
  askJevMock: vi.fn(),
}));

vi.mock("~/mastra/agents/intent-router-agent", () => ({
  intentRouterAgent: { generate: generateMock },
}));

vi.mock("~/lib/jev", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/jev")>()),
  askJev: askJevMock,
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { classifyTurn } = await import("./classify-intent");

const contextWithKey = (key?: string) => {
  const ctx = new RequestContext();
  ctx.set("env", { TYPESAFE_API_KEY: key });
  return ctx;
};

const jevResponse = (pThinking: number) => ({
  model: "jev-1.13.0",
  answers: {
    intent: {
      type: "choice" as const,
      choice: pThinking >= 0.5 ? "thinking" : "casual",
      probabilities: { casual: 1 - pThinking, thinking: pThinking },
    },
  },
  usage: { input_tokens: 600, output_tokens: 0 },
});

const sentParams = () => askJevMock.mock.calls[0]?.[0];

beforeEach(() => {
  generateMock.mockReset();
  askJevMock.mockReset();
});

describe("classifyTurn（jev）", () => {
  it.each([
    [0.31, "thinking"],
    [0.3, "thinking"],
    [0.29, "casual"],
  ])("P(thinking) が %s なら %s", async (pThinking, intent) => {
    askJevMock.mockResolvedValueOnce(jevResponse(pThinking));
    const result = await classifyTurn({ text: "q" }, contextWithKey("k"));
    expect(result).toEqual({ intent });
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("API キーと casual / thinking の選択肢を渡して 1 回だけ聞く", async () => {
    askJevMock.mockResolvedValueOnce(jevResponse(0.9));
    await classifyTurn({ text: "教えて" }, contextWithKey("secret-key"));
    expect(askJevMock).toHaveBeenCalledTimes(1);
    const params = sentParams();
    expect(params.apiKey).toBe("secret-key");
    expect(Object.keys(params.questions.intent.criteria).sort()).toEqual([
      "casual",
      "thinking",
    ]);
  });

  it("previousAssistant があれば state に assistant → user の順で含める", async () => {
    askJevMock.mockResolvedValueOnce(jevResponse(0.9));
    await classifyTurn(
      { text: "音威子府村村内で！", previousAssistant: "村内で食べたい？" },
      contextWithKey("k"),
    );
    expect(sentParams().state).toEqual([
      { from: "assistant", text: "村内で食べたい？" },
      { from: "user", text: "音威子府村村内で！" },
    ]);
  });

  it("previousAssistant が無ければ state は user だけの配列", async () => {
    askJevMock.mockResolvedValueOnce(jevResponse(0));
    await classifyTurn({ text: "こんにちは" }, contextWithKey("k"));
    expect(sentParams().state).toEqual([{ from: "user", text: "こんにちは" }]);
  });
});

describe("classifyTurn（フォールバック）", () => {
  it("TYPESAFE_API_KEY が無ければ jev を呼ばず intentRouterAgent で分類する", async () => {
    generateMock.mockResolvedValueOnce({ object: { intent: "casual" } });
    expect(
      await classifyTurn({ text: "こんにちは" }, contextWithKey()),
    ).toEqual({ intent: "casual" });
    expect(askJevMock).not.toHaveBeenCalled();
    expect(generateMock).toHaveBeenCalledWith(
      "こんにちは",
      expect.objectContaining({
        structuredOutput: { schema: expect.anything() },
      }),
    );
  });

  it("jev が throw（非 2xx・timeout・応答不正）したら intentRouterAgent に落ちる", async () => {
    askJevMock.mockRejectedValueOnce(new Error("jev responded 429"));
    generateMock.mockResolvedValueOnce({ object: { intent: "thinking" } });
    const result = await classifyTurn({ text: "教えて" }, contextWithKey("k"));
    expect(result.intent).toBe("thinking");
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it("jev の応答が判定文の選択肢と合わなければ intentRouterAgent に落ちる", async () => {
    askJevMock.mockResolvedValueOnce({
      answers: {
        intent: {
          type: "choice",
          choice: "casual",
          probabilities: { casual: 1 },
        },
      },
    });
    generateMock.mockResolvedValueOnce({ object: { intent: "casual" } });
    const result = await classifyTurn({ text: "やあ" }, contextWithKey("k"));
    expect(result.intent).toBe("casual");
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it("フォールバックの object が無ければ thinking", async () => {
    generateMock.mockResolvedValueOnce({ object: undefined });
    expect((await classifyTurn({ text: "?" })).intent).toBe("thinking");
  });

  it("フォールバックの generate が throw したら thinking", async () => {
    generateMock.mockRejectedValueOnce(new Error("model error"));
    expect((await classifyTurn({ text: "?" })).intent).toBe("thinking");
  });
});
