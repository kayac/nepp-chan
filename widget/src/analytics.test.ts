import { afterEach, describe, expect, it, vi } from "vitest";
import { initAnalytics } from "./analytics";

const gtagScript = () =>
  document.head.querySelector('script[src*="googletagmanager.com"]');

afterEach(() => {
  vi.unstubAllEnvs();
  for (const el of document.head.querySelectorAll("script")) el.remove();
});

describe("initAnalytics", () => {
  it("本番かつ測定 ID があれば gtag を読み込む", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST");

    initAnalytics();

    expect(gtagScript()?.getAttribute("src")).toContain("id=G-TEST");
  });

  it("測定 ID が無ければ読み込まない", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "");

    initAnalytics();

    expect(gtagScript()).toBeNull();
  });

  it("開発中は読み込まない", () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST");

    initAnalytics();

    expect(gtagScript()).toBeNull();
  });
});
