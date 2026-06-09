import * as Sentry from "@sentry/cloudflare";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  markPrivacyCriticalScope,
  reportPrivacyCriticalError,
} from "./sentry-helpers";

describe("reportPrivacyCriticalError", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Sentry.captureException を level: fatal + privacy_critical タグ付きで呼ぶ", () => {
    const spy = vi.spyOn(Sentry, "captureException");
    const error = new Error("boom");

    reportPrivacyCriticalError(error, "user-deletion");

    expect(spy).toHaveBeenCalledWith(error, {
      level: "fatal",
      tags: { privacy_critical: "true", component: "user-deletion" },
    });
  });
});

describe("markPrivacyCriticalScope", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("現在の scope に level: fatal + privacy_critical + component タグを設定する", () => {
    const setLevel = vi.fn();
    const setTag = vi.fn();
    vi.spyOn(Sentry, "getCurrentScope").mockReturnValue({
      setLevel,
      setTag,
      setTags: vi.fn(),
      setExtra: vi.fn(),
      setContext: vi.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Sentry の Scope 全 API を再現しないため
    } as any);

    markPrivacyCriticalScope("data-retention-handler");

    expect(setLevel).toHaveBeenCalledWith("fatal");
    expect(setTag).toHaveBeenCalledWith("privacy_critical", "true");
    expect(setTag).toHaveBeenCalledWith("component", "data-retention-handler");
  });
});
