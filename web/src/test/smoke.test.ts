import { describe, expect, it } from "vitest";

describe("vitest 基盤の smoke test", () => {
  it("jsdom 環境が利用できる", () => {
    expect(typeof window).toBe("object");
    expect(typeof document).toBe("object");
  });

  it("@testing-library/jest-dom の matcher が拡張されている", () => {
    document.body.innerHTML = "<div>hello</div>";
    expect(document.querySelector("div")).toBeInTheDocument();
  });

  it("path alias '~/' が解決される", async () => {
    const mod = await import("~/lib/format");
    expect(typeof mod).toBe("object");
  });
});
