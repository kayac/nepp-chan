import { describe, expect, it } from "vitest";

import { getTokenFromHeader } from "~/lib/auth-header";

describe("getTokenFromHeader", () => {
  const createMockContext = (authHeader?: string) => ({
    req: {
      header: (name: string) =>
        name === "Authorization" ? authHeader : undefined,
    },
  });

  it("Bearer トークンを正しく抽出する", () => {
    const context = createMockContext("Bearer abc123token");

    const result = getTokenFromHeader(context);

    expect(result).toBe("abc123token");
  });

  it("64文字のセッションIDを正しく抽出する", () => {
    const sessionId = "a".repeat(64);
    const context = createMockContext(`Bearer ${sessionId}`);

    const result = getTokenFromHeader(context);

    expect(result).toBe(sessionId);
  });

  it("Authorization ヘッダーがない場合は null を返す", () => {
    const context = createMockContext(undefined);

    const result = getTokenFromHeader(context);

    expect(result).toBeNull();
  });

  it("Authorization ヘッダーが空文字列の場合は null を返す", () => {
    const context = createMockContext("");

    const result = getTokenFromHeader(context);

    expect(result).toBeNull();
  });

  it("Bearer で始まらない場合は null を返す", () => {
    const context = createMockContext("Basic abc123");

    const result = getTokenFromHeader(context);

    expect(result).toBeNull();
  });

  it("Bearer のみでトークンがない場合は空文字列を返す", () => {
    const context = createMockContext("Bearer ");

    const result = getTokenFromHeader(context);

    expect(result).toBe("");
  });

  it("bearer（小文字）の場合は null を返す", () => {
    const context = createMockContext("bearer abc123");

    const result = getTokenFromHeader(context);

    expect(result).toBeNull();
  });
});
