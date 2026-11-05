import { describe, expect, it } from "vitest";
import { answerOnLastStep } from "./answer-on-last-step";

const stepResult = (maxSteps: number, stepNumber: number) =>
  answerOnLastStep(maxSteps).processInputStep?.({ stepNumber } as never);

describe("answerOnLastStep", () => {
  it("最後のステップではツールを使わせず文章で答えさせる", () => {
    expect(stepResult(5, 4)).toEqual({ toolChoice: "none" });
  });

  it("最後より前のステップでは何も変えない", () => {
    expect(stepResult(5, 0)).toEqual({});
    expect(stepResult(5, 3)).toEqual({});
  });

  it("maxSteps が 1 なら最初のステップから文章で答えさせる", () => {
    expect(stepResult(1, 0)).toEqual({ toolChoice: "none" });
  });
});
