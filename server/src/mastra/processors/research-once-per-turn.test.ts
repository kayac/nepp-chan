import { describe, expect, it } from "vitest";
import { researchOncePerTurn } from "./research-once-per-turn";

const run = (steps: { toolCalls: { toolName: string }[] }[]) =>
  researchOncePerTurn("researchTool").processInputStep?.({
    steps,
    tools: { researchTool: {}, chart: {} },
  } as never);

describe("researchOncePerTurn", () => {
  it("まだ調べていなければ何も変えない", () => {
    expect(run([{ toolCalls: [{ toolName: "chart" }] }])).toEqual({});
  });

  it("一度調べたら、以降のステップでは調べ物ツールを外す", () => {
    expect(run([{ toolCalls: [{ toolName: "researchTool" }] }])).toEqual({
      activeTools: ["chart"],
    });
  });
});
