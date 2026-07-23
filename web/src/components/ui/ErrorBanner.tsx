import { cn } from "@nepp-chan/shared/lib/class-merge";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export const ErrorBanner = ({ children, className }: Props) => (
  <div
    className={cn(
      "bg-(--danger-bg) text-(--danger) px-4 py-3 rounded-lg text-sm",
      className,
    )}
  >
    {children}
  </div>
);

export const formatError = (
  error: unknown,
  fallback = "Unknown error",
): string => `エラー: ${error instanceof Error ? error.message : fallback}`;
