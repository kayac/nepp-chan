import type { ReactNode } from "react";

export const ErrorBanner = ({ children }: { children: ReactNode }) => (
  <div className="bg-(--danger-bg) text-(--danger) px-4 py-3 rounded-lg text-sm">
    {children}
  </div>
);

export const formatError = (
  error: unknown,
  fallback = "Unknown error",
): string => `エラー: ${error instanceof Error ? error.message : fallback}`;
