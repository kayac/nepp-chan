import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateMock, recordUsageMock, askJevMock } = vi.hoisted(() => ({
  generateMock: vi.fn(),
  recordUsageMock: vi.fn(),
  askJevMock: vi.fn(),
}));

vi.mock("~/mastra/agents/intent-router-agent", () => ({
  intentRouterAgent: { generate: generateMock },
}));

vi.mock("~/services/analytics/llm-usage", () => ({
  recordUsageFromContext: recordUsageMock,
  runInBackground: vi.fn(),
}));

vi.mock("~/lib/jev", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/jev")>()),
  askJev: askJevMock,
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { classifyIntent } = await import("./classify-intent");

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
      confidence: Math.abs(pThinking - 0.5) * 2,
    },
  },
  usage: { input_tokens: 400, output_tokens: 0 },
});

const sentState = () => askJevMock.mock.calls[0]?.[0]?.state;

beforeEach(() => {
  generateMock.mockReset();
  recordUsageMock.mockReset();
  askJevMock.mockReset();
});

describe("classifyIntent（jev）", () => {
  it("P(thinking) がしきい値以上なら thinking", async () => {
    askJevMock.mockResolvedValueOnce(jevResponse(0.31));
    expect(
      await classifyIntent({ text: "バス動いてる？" }, contextWithKey("k")),
    ).toBe("thinking");
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("P(thinking) がしきい値ちょうどなら thinking", async () => {
    askJevMock.mockResolvedValueOnce(jevResponse(0.3));
    expect(
      await classifyIntent({ text: "ほんとに？" }, contextWithKey("k")),
    ).toBe("thinking");
  });

  it("P(thinking) がしきい値未満なら casual", async () => {
    askJevMock.mockResolvedValueOnce(jevResponse(0.29));
    expect(
      await classifyIntent({ text: "こんにちは" }, contextWithKey("k")),
    ).toBe("casual");
  });

  it("API キーと casual / thinking の 2 択質問を渡す", async () => {
    askJevMock.mockResolvedValueOnce(jevResponse(0));
    await classifyIntent({ text: "こんにちは" }, contextWithKey("secret-key"));
    const params = askJevMock.mock.calls[0]?.[0];
    expect(params.apiKey).toBe("secret-key");
    expect(params.questions.intent.type).toBe("choice");
    expect(Object.keys(params.questions.intent.criteria).sort()).toEqual([
      "casual",
      "thinking",
    ]);
  });

  it("previousAssistant があれば state に assistant → user の順で含める", async () => {
    askJevMock.mockResolvedValueOnce(jevResponse(0.9));
    await classifyIntent(
      { text: "音威子府村村内で！", previousAssistant: "村内で食べたい？" },
      contextWithKey("k"),
    );
    expect(sentState()).toEqual([
      { from: "assistant", text: "村内で食べたい？" },
      { from: "user", text: "音威子府村村内で！" },
    ]);
  });

  it("previousAssistant が無ければ state は user だけの配列", async () => {
    askJevMock.mockResolvedValueOnce(jevResponse(0));
    await classifyIntent({ text: "こんにちは" }, contextWithKey("k"));
    expect(sentState()).toEqual([{ from: "user", text: "こんにちは" }]);
  });

  it("成功時は usage を source intent-classify・応答の model で記録する", async () => {
    askJevMock.mockResolvedValueOnce(jevResponse(0.9));
    const ctx = contextWithKey("k");
    await classifyIntent({ text: "教えて" }, ctx);
    expect(recordUsageMock).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        model: "jev-1.13.0",
        source: "intent-classify",
        agent: "intent-router",
        usage: { inputTokens: 400, outputTokens: 0 },
      }),
    );
  });
});

describe("classifyIntent（フォールバック）", () => {
  it("TYPESAFE_API_KEY が無ければ jev を呼ばず intentRouterAgent で分類する", async () => {
    generateMock.mockResolvedValueOnce({ object: { intent: "casual" } });
    expect(await classifyIntent({ text: "こんにちは" }, contextWithKey())).toBe(
      "casual",
    );
    expect(askJevMock).not.toHaveBeenCalled();
    expect(generateMock).toHaveBeenCalledWith(
      "こんにちは",
      expect.objectContaining({
        structuredOutput: { schema: expect.anything() },
      }),
    );
  });

  it("requestContext が無ければ intentRouterAgent で分類する", async () => {
    generateMock.mockResolvedValueOnce({ object: { intent: "thinking" } });
    expect(await classifyIntent({ text: "教えて" })).toBe("thinking");
    expect(askJevMock).not.toHaveBeenCalled();
  });

  it("jev が throw（非 2xx・timeout・応答不正）したら intentRouterAgent に落ちる", async () => {
    askJevMock.mockRejectedValueOnce(new Error("jev responded 429"));
    generateMock.mockResolvedValueOnce({ object: { intent: "thinking" } });
    expect(await classifyIntent({ text: "教えて" }, contextWithKey("k"))).toBe(
      "thinking",
    );
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(recordUsageMock).not.toHaveBeenCalled();
  });

  it("answers.intent に thinking の確率が無ければ intentRouterAgent に落ちる", async () => {
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
    expect(await classifyIntent({ text: "やあ" }, contextWithKey("k"))).toBe(
      "casual",
    );
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it("フォールバックの object が無ければ thinking", async () => {
    generateMock.mockResolvedValueOnce({ object: undefined });
    expect(await classifyIntent({ text: "?" })).toBe("thinking");
  });

  it("フォールバックの generate が throw したら thinking", async () => {
    generateMock.mockRejectedValueOnce(new Error("model error"));
    expect(await classifyIntent({ text: "?" })).toBe("thinking");
  });
});
