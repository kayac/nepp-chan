import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { ToolLoadingState } from "@nepp-chan/shared/ui/Loading";

import {
  type ChoiceArgs,
  ChoiceButtons,
  type ChoiceResult,
  SelectedResult,
} from "./ChoiceButtons";

const renderChoiceButtons = (
  args: ChoiceArgs,
  result: ChoiceResult | undefined,
  isRunning: boolean,
  addResult: (result: ChoiceResult) => void,
) => {
  if (isRunning && !args.choices) {
    return (
      <div className="my-4">
        <ToolLoadingState variant="choice" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="my-4">
        <SelectedResult args={args} result={result} />
      </div>
    );
  }

  if (args.choices && args.question) {
    return (
      <div className="my-4">
        <ChoiceButtons
          args={args}
          onSelect={(selectedChoice, selectedIndex) => {
            addResult({ selectedChoice, selectedIndex });
          }}
        />
      </div>
    );
  }

  return (
    <div className="my-4">
      <ToolLoadingState variant="choice" />
    </div>
  );
};

export const DisplayChoiceButtonsToolComponent: ToolCallMessagePartComponent =
  ({ args, status, result, addResult }) =>
    renderChoiceButtons(
      args as unknown as ChoiceArgs,
      result as ChoiceResult | undefined,
      status?.type === "running",
      addResult as (result: ChoiceResult) => void,
    );

export const ChoiceButtonsToolUI = makeAssistantToolUI<
  ChoiceArgs,
  ChoiceResult
>({
  toolName: "select-choice",
  render: ({ args, result, status, addResult }) =>
    renderChoiceButtons(args, result, status.type === "running", addResult),
});
