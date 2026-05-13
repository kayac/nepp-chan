import { afterEach, describe, expect, it, vi } from "vitest";

import { confirmDialog } from "./dialog";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("confirmDialog", () => {
  it("window.confirm が true を返したら true", () => {
    const spy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const result = confirmDialog("送信しますか？");

    expect(spy).toHaveBeenCalledWith("送信しますか？");
    expect(result).toBe(true);
  });

  it("window.confirm が false を返したら false", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    expect(confirmDialog("削除しますか？")).toBe(false);
  });
});
