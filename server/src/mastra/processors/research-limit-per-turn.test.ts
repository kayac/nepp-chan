import { describe, expect, it } from "vitest";
import { researchLimitPerTurn } from "./research-limit-per-turn";

const run = (steps: { toolCalls: { toolName: string }[] }[]) =>
  researchLimitPerTurn("researchTool", 2).processInputStep?.({
    steps,
    tools: { researchTool: {}, chart: {} },
  } as never);

describe("researchLimitPerTurn", () => {
  it("上限に達していなければ何も変えない", () => {
    expect(run([{ toolCalls: [{ toolName: "chart" }] }])).toEqual({});
    expect(run([{ toolCalls: [{ toolName: "researchTool" }] }])).toEqual({});
  });

  it("上限の回数まで調べたら、以降のステップでは調べ物ツールを外す", () => {
    expect(
      run([
        { toolCalls: [{ toolName: "researchTool" }] },
        { toolCalls: [{ toolName: "researchTool" }, { toolName: "chart" }] },
      ]),
    ).toEqual({ activeTools: ["chart"] });
  });
});
