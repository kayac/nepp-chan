import * as Sentry from "@sentry/cloudflare";

type LogAttributes = Record<string, string | number | boolean>;

const serializeError = (error: unknown): LogAttributes => {
  if (error == null) return {};
  if (error instanceof Error) {
    const attributes: LogAttributes = {
      "error.type": error.name,
      "error.message": error.message,
    };
    if (error.cause instanceof Error) {
      attributes["error.cause.type"] = error.cause.name;
      attributes["error.cause.message"] = error.cause.message;
    }
    return attributes;
  }
  return { "error.message": String(error) };
};

export const logger = {
  info: (message: string, attrs?: LogAttributes) => {
    console.info(message, attrs ?? "");
    Sentry.logger.info(message, attrs);
  },
  warn: (message: string, attrs?: LogAttributes) => {
    console.warn(message, attrs ?? "");
    Sentry.logger.warn(message, attrs);
  },
  error: (message: string, error?: unknown, attrs?: LogAttributes) => {
    const merged = { ...serializeError(error), ...attrs };
    console.error(message, merged);
    Sentry.logger.error(message, merged);
  },
} as const;
