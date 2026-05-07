import { cn } from "@nepp-chan/shared/lib/class-merge";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  size?: Size;
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm font-medium shadow-(--shadow-float-sm)",
};

export const PromptChip = ({
  children,
  icon,
  size = "md",
  className,
  type = "button",
  ...rest
}: Props) => (
  <button
    type={type}
    {...rest}
    className={cn(
      "inline-flex items-center gap-2 rounded-full border border-(--paper-200) bg-(--paper-0) text-(--fg-2)",
      "transition-colors hover:border-(--teal-300) hover:bg-(--teal-50) hover:text-(--brand)",
      "disabled:opacity-60 disabled:cursor-not-allowed",
      sizeStyles[size],
      className,
    )}
  >
    {icon && <span aria-hidden="true">{icon}</span>}
    <span>{children}</span>
  </button>
);
