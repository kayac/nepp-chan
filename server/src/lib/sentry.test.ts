import { describe, expect, it } from "vitest";

import { getSentryOptions } from "./sentry";

const buildEnv = (
  environment = "development",
  dsn = "https://example@sentry.io/1",
) =>
  ({
    SENTRY_DSN: dsn,
    ENVIRONMENT: environment,
  }) as unknown as CloudflareBindings;

describe("getSentryOptions", () => {
  it("env の DSN と environment を引き渡す", () => {
    const options = getSentryOptions(buildEnv("staging", "dsn-x"));
    expect(options.dsn).toBe("dsn-x");
    expect(options.environment).toBe("staging");
  });

  it("production では tracesSampleRate を 0.1 に絞る", () => {
    const options = getSentryOptions(buildEnv("production"));
    expect(options.tracesSampleRate).toBe(0.1);
  });

  it("production 以外では tracesSampleRate を 1.0 にする", () => {
    const options = getSentryOptions(buildEnv("development"));
    expect(options.tracesSampleRate).toBe(1.0);
  });

  describe("beforeSend", () => {
    it("request の data / cookies / query_string を秘匿する", () => {
      const options = getSentryOptions(buildEnv());
      const event = {
        request: {
          url: "https://api.example.com/threads",
          data: { password: "secret" },
          cookies: { session: "abc" },
          query_string: "token=xyz",
        },
      };

      // biome-ignore lint/suspicious/noExplicitAny: Sentry の Event 型を最小限で再現
      const result = options.beforeSend?.(event as any, {} as any) as unknown as
        | typeof event
        | null;

      expect(result).not.toBeNull();
      const sanitized = result as typeof event;
      expect(sanitized.request.data).toBeUndefined();
      expect(sanitized.request.cookies).toBeUndefined();
      expect(sanitized.request.query_string).toBeUndefined();
      // url は秘匿対象外（そのまま残す）
      expect(sanitized.request.url).toBe("https://api.example.com/threads");
    });

    it("request が無いイベントはそのまま返す", () => {
      const options = getSentryOptions(buildEnv());
      const event = { message: "no request" };

      // biome-ignore lint/suspicious/noExplicitAny: Sentry の Event 型を最小限で再現
      const result = options.beforeSend?.(event as any, {} as any);

      expect(result).toBe(event);
    });
  });
});
