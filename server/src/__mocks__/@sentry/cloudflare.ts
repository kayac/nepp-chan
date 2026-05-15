const noop = () => {};

export const captureException = noop;
export const withSentry = (_opts: unknown, handler: unknown) => handler;

const mockScope = {
  setLevel: noop,
  setTag: noop,
  setTags: noop,
  setExtra: noop,
  setContext: noop,
};

export const getCurrentScope = () => mockScope;
export const withScope = (cb: (scope: typeof mockScope) => void) =>
  cb(mockScope);

export const logger = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  trace: noop,
  fatal: noop,
};
