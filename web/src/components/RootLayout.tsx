import { type ReactNode, StrictMode } from "react";
import { ErrorBoundary } from "~/components/ErrorBoundary";

export const RootLayout = ({ children }: { children: ReactNode }) => (
  <StrictMode>
    <ErrorBoundary>{children}</ErrorBoundary>
  </StrictMode>
);
