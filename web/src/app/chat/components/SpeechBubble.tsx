import type { CSSProperties, ReactNode } from "react";
import { cn } from "~/lib/class-merge";

type Variant = "assistant" | "user" | "apricot" | "moss";

type Props = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  style?: CSSProperties;
};

const variantStyles: Record<Variant, string> = {
  assistant:
    "bg-(--paper-0) text-(--snow-800) border border-(--paper-200) rounded-tl-[10px]",
  user: "bg-(--teal-700) text-(--paper-0) border border-(--teal-700) rounded-tr-[10px]",
  apricot:
    "bg-(--apricot-100) text-(--apricot-700) border border-(--apricot-300) rounded-tl-[10px]",
  moss: "bg-(--moss-100) text-(--moss-700) border border-(--moss-300) rounded-tl-[10px]",
};

export const SpeechBubble = ({
  children,
  variant = "assistant",
  className,
  style,
}: Props) => {
  const isUser = variant === "user";
  return (
    <div
      className={cn(
        "relative max-w-[78%] px-5 py-3.5 leading-7 break-words rounded-(--r-bubble)",
        variantStyles[variant],
        isUser
          ? "shadow-[0_8px_20px_rgba(15,118,110,0.22)]"
          : "shadow-[var(--shadow-float-sm)]",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
};
