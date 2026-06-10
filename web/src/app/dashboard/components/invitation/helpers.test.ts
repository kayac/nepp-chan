import { describe, expect, it } from "vitest";

import { buildInvitationUrl, isExpired, resolveDeleteAction } from "./helpers";

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

describe("resolveDeleteAction", () => {
  const baseInv = {
    id: "inv-1",
    username: "alice",
    usedAt: null as string | null,
    userId: null as string | null,
  };

  it("未使用の招待は招待削除", () => {
    expect(resolveDeleteAction(baseInv, false, "me")).toEqual({
      type: "invitation",
      id: "inv-1",
    });
  });

  it("登録済みで super_admin ならユーザー削除", () => {
    const inv = { ...baseInv, usedAt: "2030-01-01T00:00:00Z", userId: "u-1" };
    expect(resolveDeleteAction(inv, true, "me")).toEqual({
      type: "user",
      userId: "u-1",
    });
  });

  it("登録済みでも super_admin でなければ削除不可", () => {
    const inv = { ...baseInv, usedAt: "2030-01-01T00:00:00Z", userId: "u-1" };
    expect(resolveDeleteAction(inv, false, "me")).toBeNull();
  });

  it("自分自身のアカウントは削除不可", () => {
    const inv = { ...baseInv, usedAt: "2030-01-01T00:00:00Z", userId: "u-1" };
    expect(resolveDeleteAction(inv, true, "alice")).toBeNull();
  });

  it("登録済みなのに userId が無い行は削除対象にしない", () => {
    const inv = { ...baseInv, usedAt: "2030-01-01T00:00:00Z" };
    expect(resolveDeleteAction(inv, true, "me")).toBeNull();
  });
});
