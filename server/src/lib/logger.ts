type LogLevel = "info" | "warn" | "error";

export const logger = {
  info: (message: string, data?: Record<string, unknown>) =>
    output("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) =>
    output("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) =>
    output("error", message, data),
};

const output = (
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
) => {
  const payload = { level, message, time: new Date().toISOString(), ...data };
  const fn = level === "error" ? console.error : console.log;
  fn(JSON.stringify(payload));
};
