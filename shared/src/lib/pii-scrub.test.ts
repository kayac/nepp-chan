import { describe, expect, it } from "vitest";

import { scrubEvent, scrubString } from "./pii-scrub";

describe("scrubString", () => {
  it("LINE userId（U + 16進32桁）を REDACTED に置換する", () => {
    const input = "User U1234567890abcdef1234567890abcdef not found";
    expect(scrubString(input)).toBe("User [REDACTED_LINE_USER_ID] not found");
  });

  it("複数の LINE userId を全て置換する", () => {
    const input =
      "Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa and Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    expect(scrubString(input)).toBe(
      "[REDACTED_LINE_USER_ID] and [REDACTED_LINE_USER_ID]",
    );
  });

  it("メールアドレスを REDACTED に置換する", () => {
    const input = "contact: alice@example.com for details";
    expect(scrubString(input)).toBe("contact: [REDACTED_EMAIL] for details");
  });

  it("ハイフン付きの電話番号を REDACTED に置換する", () => {
    const input = "TEL: 090-1234-5678";
    expect(scrubString(input)).toBe("TEL: [REDACTED_PHONE]");
  });

  it("ハイフンなしの電話番号を REDACTED に置換する", () => {
    const input = "TEL: 09012345678";
    expect(scrubString(input)).toBe("TEL: [REDACTED_PHONE]");
  });

  it("複数種類の PII が混在しても全て置換する", () => {
    const input =
      "User U1234567890abcdef1234567890abcdef email alice@ex.com tel 090-1111-2222";
    expect(scrubString(input)).toBe(
      "User [REDACTED_LINE_USER_ID] email [REDACTED_EMAIL] tel [REDACTED_PHONE]",
    );
  });

  it("PII を含まない文字列はそのまま返す", () => {
    expect(scrubString("Hello world")).toBe("Hello world");
  });

  it("ハッシュ値（U で始まらない 16進32桁）はそのまま残す", () => {
    const input = "thread:abc1234567890abcdef1234567890abcdef";
    expect(scrubString(input)).toBe(input);
  });
});

describe("scrubEvent", () => {
  it("exception.values の value をマスキングする", () => {
    const event = {
      exception: {
        values: [
          {
            type: "Error",
            value: "Reply failed for user U1234567890abcdef1234567890abcdef",
          },
        ],
      },
    };
    const scrubbed = scrubEvent(event);
    expect(scrubbed.exception?.values?.[0].value).toBe(
      "Reply failed for user [REDACTED_LINE_USER_ID]",
    );
  });

  it("複数の exception.values を全てマスキングする", () => {
    const event = {
      exception: {
        values: [
          { type: "ErrorA", value: "alice@example.com" },
          { type: "ErrorB", value: "U1234567890abcdef1234567890abcdef" },
        ],
      },
    };
    const scrubbed = scrubEvent(event);
    expect(scrubbed.exception?.values?.[0].value).toBe("[REDACTED_EMAIL]");
    expect(scrubbed.exception?.values?.[1].value).toBe(
      "[REDACTED_LINE_USER_ID]",
    );
  });

  it("breadcrumbs.message をマスキングする", () => {
    const event = {
      breadcrumbs: [
        { message: "Calling delete for U1234567890abcdef1234567890abcdef" },
        { message: "Plain message" },
      ],
    };
    const scrubbed = scrubEvent(event);
    expect(scrubbed.breadcrumbs?.[0].message).toBe(
      "Calling delete for [REDACTED_LINE_USER_ID]",
    );
    expect(scrubbed.breadcrumbs?.[1].message).toBe("Plain message");
  });

  it("request.data を [Filtered] に置換する", () => {
    const event = {
      request: {
        data: { userId: "U1234567890abcdef1234567890abcdef" },
      },
    };
    const scrubbed = scrubEvent(event);
    expect(scrubbed.request?.data).toBe("[Filtered]");
  });

  it("extra の文字列値を再帰的にマスキングする", () => {
    const event = {
      extra: {
        userId: "U1234567890abcdef1234567890abcdef",
        email: "alice@example.com",
        nested: { line: "U2222222222222222222222222222222b" },
      },
    };
    const scrubbed = scrubEvent(event);
    const extra = scrubbed.extra as Record<string, unknown>;
    expect(extra.userId).toBe("[REDACTED_LINE_USER_ID]");
    expect(extra.email).toBe("[REDACTED_EMAIL]");
    expect((extra.nested as Record<string, unknown>).line).toBe(
      "[REDACTED_LINE_USER_ID]",
    );
  });

  it("contexts 内の文字列値を再帰的にマスキングする", () => {
    const event = {
      contexts: {
        user_action: {
          query: "search alice@example.com",
        },
      },
    };
    const scrubbed = scrubEvent(event);
    const ctx = scrubbed.contexts as Record<string, Record<string, unknown>>;
    expect(ctx.user_action.query).toBe("search [REDACTED_EMAIL]");
  });

  it("配列の要素も再帰的に走査する", () => {
    const event = {
      extra: {
        userIds: ["U1111111111111111111111111111111a", "alice@example.com"],
      },
    };
    const scrubbed = scrubEvent(event);
    const extra = scrubbed.extra as Record<string, unknown>;
    const list = extra.userIds as string[];
    expect(list[0]).toBe("[REDACTED_LINE_USER_ID]");
    expect(list[1]).toBe("[REDACTED_EMAIL]");
  });

  it("PII を含まないイベントはそのまま返す", () => {
    const event = {
      exception: {
        values: [
          {
            type: "TypeError",
            value: "Cannot read property 'foo' of undefined",
          },
        ],
      },
      extra: { ratio: 0.5, enabled: true },
    };
    const scrubbed = scrubEvent(event);
    expect(scrubbed).toEqual(event);
  });

  it("undefined / null フィールドはエラーにせず通過する", () => {
    const event = {
      exception: undefined,
      breadcrumbs: undefined,
      extra: { a: null, b: undefined },
    };
    expect(() => scrubEvent(event)).not.toThrow();
  });
});
