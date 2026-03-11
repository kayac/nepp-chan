import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SentryErrorBoundary } from "~/components/SentryErrorBoundary";
import "~/index.css";
import { initSentry } from "~/lib/sentry";
import { QueryProvider } from "~/providers/QueryProvider";
import { App } from "./App";

initSentry();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <SentryErrorBoundary>
      <QueryProvider>
        <App />
      </QueryProvider>
    </SentryErrorBoundary>
  </StrictMode>,
);
