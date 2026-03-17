import * as Sentry from "@sentry/react";

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    ignoreErrors: ["NotAllowedError", "AbortError", "ResizeObserver loop"],
    beforeSend(event) {
      if (event.request?.data) {
        event.request.data = "[Filtered]";
      }
      return event;
    },
  });
};
