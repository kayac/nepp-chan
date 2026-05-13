import { makeAssistantToolUI } from "@assistant-ui/react";
import { ToolLoadingState } from "@nepp-chan/shared/ui/Loading";

import {
  type ChoiceArgs,
  ChoiceButtons,
  type ChoiceResult,
  SelectedResult,
} from "./ChoiceButtons";

export const ChoiceButtonsToolUI = makeAssistantToolUI<
  ChoiceArgs,
  ChoiceResult
>({
  toolName: "select-choice",
  render: ({ args, result, status, addResult }) => {
    if (status.type === "running" && !args.choices) {
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
  },
});
