import { afterEach, describe, expect, it, vi } from "vitest";

import { redirectTo } from "./redirect";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("redirectTo", () => {
  it("window.location.href にパスを代入", () => {
    const setter = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new Proxy(
        { href: "" },
        {
          set(target, prop, value) {
            if (prop === "href") setter(value);
            (target as Record<string | symbol, unknown>)[prop] = value;
            return true;
          },
          get(target, prop) {
            return (target as Record<string | symbol, unknown>)[prop];
          },
        },
      ),
    });

    redirectTo("/dashboard");
    expect(setter).toHaveBeenCalledWith("/dashboard");
  });
});
