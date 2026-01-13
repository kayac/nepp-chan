import type { FC } from "react";

import { cn } from "~/lib/class-merge";

type LoadingDotsProps = {
  className?: string;
  size?: "sm" | "md";
};

export const LoadingDots: FC<LoadingDotsProps> = ({
  className,
  size = "md",
}) => (
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

export const Spinner: FC<SpinnerProps> = ({ className, size = "md" }) => (
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

export const LoadingText: FC<LoadingTextProps> = ({
  children = "読み込み中",
  className,
}) => (
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
