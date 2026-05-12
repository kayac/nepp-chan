import { cn } from "@nepp-chan/shared/lib/class-merge";
import { CheckCircleIcon } from "lucide-react";
import { useState } from "react";

export type ChoiceArgs = {
  question: string;
  choices: string[];
};

export type ChoiceResult = {
  selectedChoice: string;
  selectedIndex: number;
};

type Props = {
  args: ChoiceArgs;
  onSelect: (choice: string, index: number) => void;
};

export const ChoiceButtons = ({ args, onSelect }: Props) => {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (choice: string, index: number) => {
    setSelected(index);
    onSelect(choice, index);
  };

  return (
    <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 p-4">
      <p className="mb-3 font-medium text-gray-700">{args.question}</p>
      <div className="flex flex-wrap gap-2">
        {args.choices.map((choice, index) => (
          <button
            key={choice}
            type="button"
            onClick={() => handleSelect(choice, index)}
            disabled={selected !== null}
            className={cn(
              "flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-medium transition-all",
              selected === index
                ? "border-amber-500 bg-amber-500 text-white"
                : selected !== null
                  ? "border-gray-200 bg-gray-100 text-gray-400"
                  : "border-amber-200 bg-white text-amber-700 hover:border-amber-400 hover:bg-amber-50",
            )}
          >
            {selected === index && <CheckCircleIcon className="size-4" />}
            {choice}
          </button>
        ))}
      </div>
    </div>
  );
};

export const SelectedResult = ({
  args,
  result,
}: {
  args: ChoiceArgs;
  result: ChoiceResult;
}) => (
  <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 p-4">
    <p className="mb-3 text-sm text-gray-600">{args.question}</p>
    <div className="flex flex-wrap gap-2">
      {args.choices.map((choice, index) => (
        <div
          key={choice}
          className={cn(
            "flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-medium",
            index === result.selectedIndex
              ? "border-amber-500 bg-amber-500 text-white"
              : "border-gray-200 bg-gray-100 text-gray-400",
          )}
        >
          {index === result.selectedIndex && (
            <CheckCircleIcon className="size-4" />
          )}
          {choice}
        </div>
      ))}
    </div>
  </div>
);
