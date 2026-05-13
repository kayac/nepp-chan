import { describe, expect, it } from "vitest";

import { buildInvitationUrl, isExpired } from "./helpers";

describe("buildInvitationUrl", () => {
  it("origin と token から完全 URL を生成", () => {
    expect(buildInvitationUrl("https://example.com", "abc")).toBe(
      "https://example.com/register?token=abc",
    );
  });

  it("末尾スラッシュ無しでも結合される", () => {
    expect(buildInvitationUrl("http://localhost:5173", "xyz")).toBe(
      "http://localhost:5173/register?token=xyz",
    );
  });
});

describe("isExpired", () => {
  it("期限が現在より前なら true", () => {
    const now = new Date("2030-01-10T00:00:00Z");
    expect(isExpired("2030-01-01T00:00:00Z", now)).toBe(true);
  });

  it("期限が現在より後なら false", () => {
    const now = new Date("2030-01-10T00:00:00Z");
    expect(isExpired("2030-12-31T23:59:59Z", now)).toBe(false);
  });

  it("now のデフォルトは現在時刻", () => {
    expect(isExpired("1900-01-01T00:00:00Z")).toBe(true);
    expect(isExpired("9999-01-01T00:00:00Z")).toBe(false);
  });
});
