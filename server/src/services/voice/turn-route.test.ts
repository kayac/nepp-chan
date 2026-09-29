import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { askJevMock } = vi.hoisted(() => ({ askJevMock: vi.fn() }));

vi.mock("~/services/analytics/llm-usage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/services/analytics/llm-usage")>()),
  askJevWithUsage: askJevMock,
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { classifyVoiceTurn } = await import("./turn-route");

const contextWithKey = (key?: string) => {
  const ctx = new RequestContext();
  ctx.set("env", { TYPESAFE_API_KEY: key });
  return ctx;
};

const jevResponse = (probabilities: Record<string, number>) => ({
  answers: {
    route: {
      type: "choice" as const,
      choice: Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0],
      probabilities,
    },
  },
});

beforeEach(() => {
  askJevMock.mockReset();
});

describe("classifyVoiceTurn", () => {
  it("P(village) が 0.3 以上なら village", async () => {
    askJevMock.mockResolvedValueOnce(
      jevResponse({ none: 0.4, village: 0.3, outside: 0.3 }),
    );
    expect(
      await classifyVoiceTurn({
        text: "寮費は？",
        requestContext: contextWithKey("k"),
      }),
    ).toBe("village");
  });

  it("P(village) が 0.3 未満なら、none と outside のうち確率の高いほう", async () => {
    askJevMock.mockResolvedValueOnce(
      jevResponse({ none: 0.2, village: 0.1, outside: 0.7 }),
    );
    expect(
      await classifyVoiceTurn({
        text: "明日の天気は？",
        requestContext: contextWithKey("k"),
      }),
    ).toBe("outside");

    askJevMock.mockResolvedValueOnce(
      jevResponse({ none: 0.8, village: 0.1, outside: 0.1 }),
    );
    expect(
      await classifyVoiceTurn({
        text: "こんにちは",
        requestContext: contextWithKey("k"),
      }),
    ).toBe("none");
  });

  it("発話と行き先の 3 択を jev に渡し、usage を voice-router として記録させる", async () => {
    askJevMock.mockResolvedValueOnce(
      jevResponse({ none: 1, village: 0, outside: 0 }),
    );
    const ctx = contextWithKey("secret");
    await classifyVoiceTurn({ text: "こんにちは", requestContext: ctx });
    const params = askJevMock.mock.calls[0]?.[0];
    expect(params.apiKey).toBe("secret");
    expect(params.state).toEqual([{ from: "user", text: "こんにちは" }]);
    expect(Object.keys(params.questions.route.criteria).sort()).toEqual([
      "none",
      "outside",
      "village",
    ]);
    expect(params).toMatchObject({
      requestContext: ctx,
      source: "research-route",
      agent: "voice-router",
    });
  });

  it.each([
    ["教えて", "village"],
    ["こんにちは", "none"],
  ] as const)(
    "TYPESAFE_API_KEY が無ければ質問らしさで判定する（%s → %s）",
    async (text, expected) => {
      expect(
        await classifyVoiceTurn({ text, requestContext: contextWithKey() }),
      ).toBe(expected);
      expect(askJevMock).not.toHaveBeenCalled();
    },
  );

  it("jev が失敗したら質問らしさで判定する", async () => {
    askJevMock.mockRejectedValueOnce(new Error("jev responded 429"));
    expect(
      await classifyVoiceTurn({
        text: "どこにあるの？",
        requestContext: contextWithKey("k"),
      }),
    ).toBe("village");
  });
});
