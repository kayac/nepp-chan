type Pattern = { regex: RegExp; replacement: string };

const PATTERNS: Pattern[] = [
  { regex: /U[a-f0-9]{32}/g, replacement: "[REDACTED_LINE_USER_ID]" },
  { regex: /[\w.+-]+@[\w.-]+\.\w+/g, replacement: "[REDACTED_EMAIL]" },
  { regex: /\b0\d{1,4}-?\d{1,4}-?\d{4}\b/g, replacement: "[REDACTED_PHONE]" },
];

export const scrubString = (value: string): string =>
  PATTERNS.reduce(
    (acc, { regex, replacement }) => acc.replace(regex, replacement),
    value,
  );

const scrubValue = (value: unknown): unknown => {
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        scrubValue(v),
      ]),
    );
  }
  return value;
};

type SentryLikeEvent = {
  exception?: { values?: Array<{ type?: string; value?: string }> };
  breadcrumbs?: Array<{ message?: string }>;
  request?: { data?: unknown };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
};

export const scrubEvent = <T extends SentryLikeEvent>(event: T): T => {
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((v) => ({
      ...v,
      value: v.value ? scrubString(v.value) : v.value,
    }));
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      message: b.message ? scrubString(b.message) : b.message,
    }));
  }

  if (event.request?.data !== undefined) {
    event.request.data = "[Filtered]";
  }

  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>;
  }

  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as Record<string, unknown>;
  }

  return event;
};
