import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateMock } = vi.hoisted(() => ({
  generateMock: vi.fn(),
}));

vi.mock("~/mastra/agents/intent-router-agent", () => ({
  intentRouterAgent: {
    generate: generateMock,
  },
}));

const { classifyIntent, heuristicIntent } = await import("./classify-intent");

beforeEach(() => {
  generateMock.mockReset();
});

describe("heuristicIntent", () => {
  it("挨拶・相槌だけのメッセージは casual と即断する", () => {
    expect(heuristicIntent("こんにちは")).toBe("casual");
    expect(heuristicIntent("もしもし")).toBe("casual");
    expect(heuristicIntent("ありがとう！")).toBe("casual");
    expect(heuristicIntent("うん、わかった")).toBe("casual");
  });

  it("疑問符・長文・挨拶以外は判断を保留して null を返す", () => {
    expect(heuristicIntent("元気？")).toBeNull();
    expect(heuristicIntent("音威子府そばってどこで食べられるの")).toBeNull();
    expect(heuristicIntent("難しい質問")).toBeNull();
    expect(heuristicIntent("")).toBeNull();
  });
});

describe("classifyIntent", () => {
  it("明らかな casual はヒューリスティックで即断し LLM を呼ばない", async () => {
    expect(await classifyIntent("こんにちは")).toBe("casual");
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("intent: casual が返ればそのまま返す", async () => {
    generateMock.mockResolvedValueOnce({ object: { intent: "casual" } });
    expect(await classifyIntent("おなかすいたなあ")).toBe("casual");
    expect(generateMock).toHaveBeenCalled();
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
