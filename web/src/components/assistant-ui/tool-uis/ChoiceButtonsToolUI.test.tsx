import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

import { DisplayChoiceButtonsToolComponent } from "./ChoiceButtonsToolUI";

const Comp = DisplayChoiceButtonsToolComponent as unknown as ComponentType<
  Record<string, unknown>
>;

const baseArgs = {
  question: "好きな色は？",
  choices: ["赤", "青", "緑"],
};

type RenderOptions = {
  args?: Partial<typeof baseArgs>;
  result?: { selectedChoice: string; selectedIndex: number };
  running?: boolean;
  addResult?: (...args: unknown[]) => unknown;
};

const renderChoice = ({
  args = {},
  result,
  running = false,
  addResult = () => undefined,
}: RenderOptions = {}) =>
  render(
    <Comp
      args={{ ...baseArgs, ...args }}
      argsText=""
      result={result}
      status={
        running ? { type: "running" } : { type: "complete", reason: "stop" }
      }
      toolCallId="t-1"
      toolName="select-choice"
      addResult={addResult}
      type="tool-call"
    />,
  );

describe("DisplayChoiceButtonsToolComponent", () => {
  it("running + choices 未到着ならローディングを表示する", () => {
    renderChoice({
      args: { choices: undefined as unknown as string[] },
      running: true,
    });
    expect(screen.queryByText("好きな色は？")).toBeNull();
  });

  it("result があれば SelectedResult を表示する", () => {
    renderChoice({ result: { selectedChoice: "青", selectedIndex: 1 } });
    expect(screen.getByText("好きな色は？")).toBeDefined();
    expect(screen.getByText("青")).toBeDefined();
  });

  it("choices と question が揃えば ChoiceButtons を描画し選択で addResult を呼ぶ", () => {
    const addResult = vi.fn();
    renderChoice({ addResult });

    fireEvent.click(screen.getByRole("button", { name: "緑" }));

    expect(addResult).toHaveBeenCalledWith({
      selectedChoice: "緑",
      selectedIndex: 2,
    });
  });

  it("question が無いとローディングにフォールバックする", () => {
    renderChoice({ args: { question: undefined as unknown as string } });
    expect(screen.queryByRole("button", { name: "赤" })).toBeNull();
  });
});
