import type { CloudflareOptions } from "@sentry/cloudflare";

export const getSentryOptions = (
  env: CloudflareBindings,
): CloudflareOptions => ({
  dsn: env.SENTRY_DSN,
  environment: env.ENVIRONMENT,
  tracesSampleRate: (env.ENVIRONMENT as string) === "production" ? 0.1 : 1.0,
  sendDefaultPii: false,
  _experiments: {
    enableLogs: true,
  },
  beforeSend(event) {
    if (event.request) {
      event.request.data = undefined;
      event.request.cookies = undefined;
      event.request.query_string = undefined;
    }
    return event;
  },
});
