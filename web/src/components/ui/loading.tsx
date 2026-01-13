import { cn } from "~/lib/class-merge";

type LoadingDotsProps = {
  className?: string;
  size?: "sm" | "md";
};

export const LoadingDots = ({ className, size = "md" }: LoadingDotsProps) => (
  <output
    className={cn(
      "loading-dots",
      size === "sm" && "loading-dots-sm",
      className,
    )}
    aria-label="読み込み中"
  >
    <span />
    <span />
    <span />
  </output>
);

type SpinnerProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

export const Spinner = ({ className, size = "md" }: SpinnerProps) => (
  <output
    className={cn(
      "spinner",
      size === "sm" && "spinner-sm",
      size === "lg" && "spinner-lg",
      className,
    )}
    aria-label="読み込み中"
  />
);

type LoadingTextProps = {
  children?: string;
  className?: string;
};

export const LoadingText = ({
  children = "読み込み中",
  className,
}: LoadingTextProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-2 text-(--color-text-muted) text-sm",
      className,
    )}
  >
    <Spinner size="sm" />
    {children}
  </span>
);
