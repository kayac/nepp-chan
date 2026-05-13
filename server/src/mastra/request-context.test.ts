import { describe, expect, it } from "vitest";

import { createRequestContext } from "./request-context";

describe("createRequestContext", () => {
  const baseValues = {
    db: { id: "d1" } as unknown as D1Database,
    env: { foo: "bar" } as unknown as CloudflareBindings,
  };

  it("db と env は必ずセットされる", () => {
    const ctx = createRequestContext(baseValues);
    expect(ctx.get("db")).toBe(baseValues.db);
    expect(ctx.get("env")).toBe(baseValues.env);
  });

  it("storage が渡されればセットされる", () => {
    const storage = { id: "store" } as never;
    const ctx = createRequestContext({ ...baseValues, storage });
    expect(ctx.get("storage")).toBe(storage);
  });

  it("storage が無ければ storage キーは未設定", () => {
    const ctx = createRequestContext(baseValues);
    expect(ctx.get("storage")).toBeUndefined();
  });

  it("conversationEndedAt が渡されればセットされる", () => {
    const ctx = createRequestContext({
      ...baseValues,
      conversationEndedAt: "2030-01-01T00:00:00Z",
    });
    expect(ctx.get("conversationEndedAt")).toBe("2030-01-01T00:00:00Z");
  });

  it("adminUser が渡されればセットされる", () => {
    const adminUser = { id: "u1", username: "alice", role: "admin" } as never;
    const ctx = createRequestContext({ ...baseValues, adminUser });
    expect(ctx.get("adminUser")).toBe(adminUser);
  });

  it("オプション系は未指定なら未設定", () => {
    const ctx = createRequestContext(baseValues);
    expect(ctx.get("conversationEndedAt")).toBeUndefined();
    expect(ctx.get("adminUser")).toBeUndefined();
  });
});
