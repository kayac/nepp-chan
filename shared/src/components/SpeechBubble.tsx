import { cn } from "@nepp-chan/shared/lib/class-merge";
import type { CSSProperties, ReactNode } from "react";

type Variant = "assistant" | "user";

type Props = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  style?: CSSProperties;
};

const variantStyles: Record<Variant, string> = {
  assistant: cn(
    "bg-(--paper-0) text-(--snow-800) border border-(--paper-200)",
    "rounded-tl-[10px] shadow-[var(--shadow-float-sm)]",
  ),
  user: cn(
    "bg-(--teal-700) text-(--paper-0) border border-(--teal-700)",
    "rounded-tr-[10px] shadow-[0_8px_20px_rgba(15,118,110,0.22)]",
  ),
};

export const SpeechBubble = ({
  children,
  variant = "assistant",
  className,
  style,
}: Props) => (
  <div
    className={cn(
      "relative max-w-[78%] px-5 py-3.5 leading-7 break-words rounded-(--r-bubble)",
      variantStyles[variant],
      className,
    )}
    style={style}
  >
    {children}
  </div>
);
