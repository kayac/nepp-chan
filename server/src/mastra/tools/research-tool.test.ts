import { describe, expect, it, vi } from "vitest";

const { researchMock } = vi.hoisted(() => ({ researchMock: vi.fn() }));

vi.mock("~/services/research", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/services/research")>()),
  research: researchMock,
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
    ) => Promise<{ materials: string; failed: boolean }>
  )(input, undefined);

describe("researchTool", () => {
  it("質問と観点をそのまま検索に渡し、資料を返す", async () => {
    researchMock.mockResolvedValueOnce("寮費は3万円");
    expect(await execute()).toEqual({
      materials: "寮費は3万円",
      failed: false,
    });
    expect(researchMock.mock.calls[0]?.[0]).toEqual(input);
  });

  it("検索が失敗したら空の資料と failed を返す", async () => {
    researchMock.mockRejectedValueOnce(new Error("boom"));
    expect(await execute()).toEqual({ materials: "", failed: true });
  });
});
