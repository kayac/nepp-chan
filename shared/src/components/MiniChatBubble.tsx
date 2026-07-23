import { cn } from "@nepp-chan/shared/lib/class-merge";
import type { ReactNode } from "react";

type Props = {
  variant: "user" | "assistant";
  children: ReactNode;
  className?: string;
};

export const MiniChatBubble = ({ variant, children, className }: Props) => (
  <div
    className={cn(
      "w-fit max-w-[85%] break-words rounded-(--r-bubble) px-[18px] py-3 text-sm leading-[1.7]",
      variant === "user"
        ? "self-end bg-(--brand-hover) text-white"
        : "self-start bg-(--paper-50) text-(--fg-1)",
      className,
    )}
  >
    {children}
  </div>
);
