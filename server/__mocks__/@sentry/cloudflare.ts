const noop = () => {};

export const captureException = noop;
export const withSentry = (_opts: unknown, handler: unknown) => handler;

export const logger = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  trace: noop,
  fatal: noop,
};
