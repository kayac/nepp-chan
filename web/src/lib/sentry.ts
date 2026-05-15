import * as Sentry from "@sentry/react";

export const initSentry = () => {
  const dsn = import.meta.env.PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    sendDefaultPii: false,
    ignoreErrors: ["NotAllowedError", "AbortError", "ResizeObserver loop"],
    beforeSend(event) {
      if (event.request) {
        event.request.data = undefined;
        event.request.cookies = undefined;
        event.request.query_string = undefined;
      }
      return event;
    },
  });
};
