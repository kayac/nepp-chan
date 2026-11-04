import { describe, expect, it, vi } from "vitest";

const { runResearchMock } = vi.hoisted(() => ({ runResearchMock: vi.fn() }));

vi.mock("~/mastra/workflows/research-workflow", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/mastra/workflows/research-workflow")
  >()),
  runResearch: runResearchMock,
}));

vi.mock("~/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { researchTool } = await import("./research-tool");

type Input = {
  question: string;
  aspects: { topic: string; queries: string[] }[];
};

const input: Input = {
  question: "寮費は？",
  aspects: [{ topic: "寮費", queries: ["寮費"] }],
};

const execute = () =>
  (
    researchTool.execute as unknown as (
      input: Input,
      context: undefined,
    ) => Promise<{ memo: string; failed: boolean }>
  )(input, undefined);

describe("researchTool", () => {
  it("質問と観点をそのままワークフローに渡し、調査メモを返す", async () => {
    runResearchMock.mockResolvedValueOnce({ memo: "寮費は3万円" });
    expect(await execute()).toEqual({ memo: "寮費は3万円", failed: false });
    expect(runResearchMock).toHaveBeenCalledWith(
      expect.objectContaining({ input }),
    );
  });

  it("ワークフローが失敗したら空のメモと failed を返す", async () => {
    runResearchMock.mockRejectedValueOnce(new Error("boom"));
    expect(await execute()).toEqual({ memo: "", failed: true });
  });
});
