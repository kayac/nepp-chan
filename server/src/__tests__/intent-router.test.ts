import { describe, expect, it } from "vitest";
import {
  GEMINI_FLASH,
  GEMINI_FLASH_LITE,
  type Intent,
  resolveModelTier,
} from "~/lib/llm-models";

describe("resolveModelTier", () => {
  describe("Admin は常に thinking/web ティア", () => {
    const intents: Intent[] = ["casual", "normal", "thinking"];
    const platforms = ["web", "line"] as const;

    for (const intent of intents) {
      for (const platform of platforms) {
        it(`intent=${intent}, platform=${platform} でも FLASH + high`, () => {
          const tier = resolveModelTier({ intent, platform, isAdmin: true });
          expect(tier.model).toBe(GEMINI_FLASH);
          expect(tier.providerOptions.google.thinkingConfig.thinkingLevel).toBe(
            "high",
          );
        });
      }
    }
  });

  describe("Web プラットフォーム（非 Admin）", () => {
    it("casual → FLASH_LITE + low", () => {
      const tier = resolveModelTier({
        intent: "casual",
        platform: "web",
        isAdmin: false,
      });
      expect(tier.model).toBe(GEMINI_FLASH_LITE);
      expect(tier.providerOptions.google.thinkingConfig.thinkingLevel).toBe(
        "low",
      );
    });

    it("normal → FLASH + medium", () => {
      const tier = resolveModelTier({
        intent: "normal",
        platform: "web",
        isAdmin: false,
      });
      expect(tier.model).toBe(GEMINI_FLASH);
      expect(tier.providerOptions.google.thinkingConfig.thinkingLevel).toBe(
        "medium",
      );
    });

    it("thinking → FLASH + high", () => {
      const tier = resolveModelTier({
        intent: "thinking",
        platform: "web",
        isAdmin: false,
      });
      expect(tier.model).toBe(GEMINI_FLASH);
      expect(tier.providerOptions.google.thinkingConfig.thinkingLevel).toBe(
        "high",
      );
    });
  });

  describe("LINE プラットフォーム（非 Admin）", () => {
    it("casual → FLASH_LITE + low", () => {
      const tier = resolveModelTier({
        intent: "casual",
        platform: "line",
        isAdmin: false,
      });
      expect(tier.model).toBe(GEMINI_FLASH_LITE);
      expect(tier.providerOptions.google.thinkingConfig.thinkingLevel).toBe(
        "low",
      );
    });

    it("normal → FLASH_LITE + medium", () => {
      const tier = resolveModelTier({
        intent: "normal",
        platform: "line",
        isAdmin: false,
      });
      expect(tier.model).toBe(GEMINI_FLASH_LITE);
      expect(tier.providerOptions.google.thinkingConfig.thinkingLevel).toBe(
        "medium",
      );
    });

    it("thinking → FLASH + medium", () => {
      const tier = resolveModelTier({
        intent: "thinking",
        platform: "line",
        isAdmin: false,
      });
      expect(tier.model).toBe(GEMINI_FLASH);
      expect(tier.providerOptions.google.thinkingConfig.thinkingLevel).toBe(
        "medium",
      );
    });
  });
});
