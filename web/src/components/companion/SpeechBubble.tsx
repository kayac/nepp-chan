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

const tailStyles: Record<Variant, { fill: string; stroke?: string }> = {
  assistant: { fill: "var(--paper-0)", stroke: "var(--paper-200)" },
  user: { fill: "var(--teal-700)" },
  apricot: { fill: "var(--apricot-100)", stroke: "var(--apricot-300)" },
  moss: { fill: "var(--moss-100)", stroke: "var(--moss-300)" },
};

export const SpeechBubble = ({
  children,
  variant = "assistant",
  className,
  style,
}: Props) => {
  const tail = tailStyles[variant];
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
      <svg
        className="absolute -bottom-3.5"
        style={{
          [isUser ? "right" : "left"]: 18,
          transform: isUser ? "scaleX(-1)" : undefined,
        }}
        width="28"
        height="18"
        viewBox="0 0 28 18"
        aria-hidden="true"
      >
        <path
          d="M0 0 Q 14 2 14 18 Q 14 2 28 0 Z"
          fill={tail.fill}
          stroke={tail.stroke}
          strokeWidth={tail.stroke ? 0.6 : undefined}
        />
      </svg>
    </div>
  );
};
