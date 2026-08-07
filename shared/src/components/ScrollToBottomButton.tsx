import { ArrowDownIcon } from "@heroicons/react/24/outline";

import { cn } from "../lib/class-merge";

type Props = {
  isAtBottom: boolean;
  onClick: () => void;
  className?: string;
};

export const ScrollToBottomButton = ({
  isAtBottom,
  onClick,
  className,
}: Props) => (
  <button
    type="button"
    onClick={onClick}
    disabled={isAtBottom}
    className={cn(
      "size-9 rounded-full grid place-items-center",
      "bg-(--paper-0) border border-(--paper-200) text-(--fg-2)",
      "transition-all duration-200 hover:border-(--teal-300) hover:text-(--teal-700)",
      "disabled:invisible opacity-90 hover:opacity-100",
      className,
    )}
    style={{ boxShadow: "var(--shadow-float-sm)" }}
    aria-label="下にスクロール"
  >
    <ArrowDownIcon className="size-3.5" aria-hidden="true" />
  </button>
);
