import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCurrentPageUrl } from "./current-page";
import {
  CURRENT_PAGE_REQUEST_MESSAGE_TYPE,
  CURRENT_PAGE_RESPONSE_MESSAGE_TYPE,
} from "./messages";

const originalParent = window.parent;

afterEach(() => {
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: originalParent,
  });
});

describe("requestCurrentPageUrl", () => {
  it("親ページへ問い合わせて返された現在 URL を使う", async () => {
    const parent = {
      postMessage: vi.fn(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            source: parent as unknown as Window,
            data: {
              type: CURRENT_PAGE_RESPONSE_MESSAGE_TYPE,
              currentPageUrl: "https://www.vill.otoineppu.hokkaido.jp/kurashi/",
            },
          }),
        );
      }),
    };
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: parent,
    });

    await expect(requestCurrentPageUrl()).resolves.toBe(
      "https://www.vill.otoineppu.hokkaido.jp/kurashi/",
    );
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: CURRENT_PAGE_REQUEST_MESSAGE_TYPE },
      "*",
    );
  });
});
