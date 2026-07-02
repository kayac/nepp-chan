import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateMock } = vi.hoisted(() => ({
  generateMock: vi.fn(),
}));

vi.mock("~/mastra/agents/intent-router-agent", () => ({
  intentRouterAgent: {
    generate: generateMock,
  },
}));

const { classifyIntent } = await import("./classify-intent");

beforeEach(() => {
  generateMock.mockReset();
});

describe("classifyIntent", () => {
  it("intent: casual が返ればそのまま返す", async () => {
    generateMock.mockResolvedValueOnce({ object: { intent: "casual" } });
    expect(await classifyIntent("こんにちは")).toBe("casual");
  });

  it("intent: thinking が返ればそのまま返す", async () => {
    generateMock.mockResolvedValueOnce({ object: { intent: "thinking" } });
    expect(await classifyIntent("難しい質問")).toBe("thinking");
  });

  it("object が無いと thinking にフォールバック", async () => {
    generateMock.mockResolvedValueOnce({ object: undefined });
    expect(await classifyIntent("?")).toBe("thinking");
  });

  it("agent.generate が throw したら thinking にフォールバック", async () => {
    generateMock.mockRejectedValueOnce(new Error("model error"));
    expect(await classifyIntent("?")).toBe("thinking");
  });

  it("structuredOutput.schema を引数で渡している", async () => {
    generateMock.mockResolvedValueOnce({ object: { intent: "casual" } });
    await classifyIntent("hi");
    const args = generateMock.mock.calls[0]?.[1] as {
      structuredOutput: { schema: unknown };
    };
    expect(args.structuredOutput.schema).toBeDefined();
  });
});
