import { beforeEach, describe, expect, it, vi } from "vitest";

const { runResearchMock } = vi.hoisted(() => ({ runResearchMock: vi.fn() }));

vi.mock("~/mastra/workflows/research-workflow", () => ({
  runResearch: runResearchMock,
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { researchTool } = await import("./research-tool");

import { callTool } from "~/__tests__/helpers/tool-context";

beforeEach(() => {
  runResearchMock.mockReset();
});

describe("researchTool.execute", () => {
  it("質問と requestContext でワークフローを実行し、調査メモを返す", async () => {
    runResearchMock.mockResolvedValueOnce({ memo: "寮費は月額30,000円" });

    const result = await callTool(researchTool, { question: "寮費は？" });

    expect(result).toEqual({ memo: "寮費は月額30,000円" });
    const args = runResearchMock.mock.calls[0]?.[0];
    expect(args.question).toBe("寮費は？");
    expect(args.requestContext).toBeDefined();
  });

  it("ワークフローが失敗したら、調べられなかったことを伝えるメモを返す", async () => {
    runResearchMock.mockRejectedValueOnce(
      new Error("research workflow failed"),
    );

    const result = await callTool(researchTool, { question: "寮費は？" });

    expect(result.memo).toContain("調べられなかった");
  });
});
