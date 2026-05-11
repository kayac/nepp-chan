type LogAttributes = Record<string, string | number | boolean>;

export const logger = {
  info: (message: string, attrs?: LogAttributes) => {
    console.info(message, attrs ?? "");
  },
  warn: (message: string, attrs?: LogAttributes) => {
    console.warn(message, attrs ?? "");
  },
  error: (message: string, error?: unknown, attrs?: LogAttributes) => {
    console.error(message, error ?? "", attrs ?? "");
  },
} as const;
