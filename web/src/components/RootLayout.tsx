import { type ReactNode, StrictMode } from "react";
import { SentryErrorBoundary } from "~/components/SentryErrorBoundary";
import { initSentry } from "~/lib/sentry";

initSentry();

export const RootLayout = ({ children }: { children: ReactNode }) => (
  <StrictMode>
    <SentryErrorBoundary>{children}</SentryErrorBoundary>
  </StrictMode>
);
