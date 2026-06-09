import { HTTPFetchError } from "@line/bot-sdk";
import * as Sentry from "@sentry/cloudflare";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";

vi.mock("@sentry/cloudflare", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("logger.error", () => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  beforeEach(() => {
    consoleErrorSpy.mockClear();
    vi.mocked(Sentry.logger.error).mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("Error の class field を Workers Logs に流さない", () => {
    const error = new HTTPFetchError("400 - Bad Request", {
      status: 400,
      statusText: "Bad Request",
      headers: new Headers({ authorization: "Bearer secret-token" }),
      body: JSON.stringify({ message: "invalid", to: "U_LINE_USER_ID_RAW" }),
    });

    logger.error("LINE reply failed", error);

    const [, attrs] = consoleErrorSpy.mock.calls[0];
    expect(attrs).toEqual({
      "error.type": "HTTPFetchError",
      "error.message": "400 - Bad Request",
    });
  });

  it("console.error と Sentry.logger.error に同一 payload を渡す", () => {
    const error = new Error("boom");

    logger.error("op failed", error, { threadId: "line-thread:abc" });

    const expected = {
      "error.type": "Error",
      "error.message": "boom",
      threadId: "line-thread:abc",
    };
    expect(consoleErrorSpy).toHaveBeenCalledWith("op failed", expected);
    expect(Sentry.logger.error).toHaveBeenCalledWith("op failed", expected);
  });

  it("error が undefined でも attrs だけで動く", () => {
    logger.error("just a message", undefined, { count: 3 });

    expect(consoleErrorSpy).toHaveBeenCalledWith("just a message", {
      count: 3,
    });
  });

  it("Error 以外の値は error.message に String 化される", () => {
    logger.error("non-error", "string-error");

    expect(consoleErrorSpy).toHaveBeenCalledWith("non-error", {
      "error.message": "string-error",
    });
  });
});
