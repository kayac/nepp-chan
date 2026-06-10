import { describe, expect, it, vi } from "vitest";
import { waitUntilSafe } from "./wait-until";

describe("waitUntilSafe", () => {
  it("executionCtx があれば waitUntil に Promise を渡す", () => {
    const waitUntil = vi.fn();
    const promise = Promise.resolve();

    waitUntilSafe({ executionCtx: { waitUntil } }, promise);

    expect(waitUntil).toHaveBeenCalledWith(promise);
  });

  it("executionCtx へのアクセスが throw する環境でも例外を投げない", () => {
    const c = {
      get executionCtx(): { waitUntil: (p: Promise<unknown>) => void } {
        throw new Error("This context has no ExecutionContext");
      },
    };

    expect(() => waitUntilSafe(c, Promise.resolve())).not.toThrow();
  });
});
