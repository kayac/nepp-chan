import type { CloudflareOptions } from "@sentry/cloudflare";

export const getSentryOptions = (
  env: CloudflareBindings,
): CloudflareOptions => ({
  dsn: env.SENTRY_DSN,
  environment: env.ENVIRONMENT,
  tracesSampleRate: (env.ENVIRONMENT as string) === "production" ? 0.1 : 1.0,
  beforeSend(event) {
    if (event.request?.data) {
      event.request.data = "[Filtered]";
    }
    return event;
  },
});
