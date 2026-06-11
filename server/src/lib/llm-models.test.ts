import { describe, expect, it } from "vitest";
import {
  GEMINI_FLASH,
  GEMINI_FLASH_LITE,
  type Intent,
  primaryModelId,
  resolveModelTier,
} from "./llm-models";

describe("resolveModelTier", () => {
  describe("Admin は常に thinking/web ティア", () => {
    const intents: Intent[] = ["casual", "thinking"];
    const platforms = ["web", "line"] as const;

    for (const intent of intents) {
      for (const platform of platforms) {
        it(`intent=${intent}, platform=${platform} でもプライマリ FLASH + high`, () => {
          const tier = resolveModelTier({ intent, platform, isAdmin: true });
          expect(tier.model[0].model).toBe(GEMINI_FLASH);
          expect(
            tier.model[0].providerOptions.google.thinkingConfig.thinkingLevel,
          ).toBe("high");
        });
      }
    }
  });

  describe("Web プラットフォーム（非 Admin）", () => {
    it("casual → プライマリ FLASH_LITE + low、フォールバック FLASH", () => {
      const tier = resolveModelTier({
        intent: "casual",
        platform: "web",
        isAdmin: false,
      });
      expect(tier.model.map((m) => m.model)).toEqual([
        GEMINI_FLASH_LITE,
        GEMINI_FLASH,
      ]);
      expect(
        tier.model[0].providerOptions.google.thinkingConfig.thinkingLevel,
      ).toBe("low");
    });

    it("thinking → プライマリ FLASH + high、フォールバック FLASH_LITE", () => {
      const tier = resolveModelTier({
        intent: "thinking",
        platform: "web",
        isAdmin: false,
      });
      expect(tier.model.map((m) => m.model)).toEqual([
        GEMINI_FLASH,
        GEMINI_FLASH_LITE,
      ]);
      expect(
        tier.model[0].providerOptions.google.thinkingConfig.thinkingLevel,
      ).toBe("high");
    });
  });

  describe("LINE プラットフォーム（非 Admin）", () => {
    it("casual → プライマリ FLASH_LITE + thinking 無効 (thinkingBudget: 0)", () => {
      const tier = resolveModelTier({
        intent: "casual",
        platform: "line",
        isAdmin: false,
      });
      expect(tier.model[0].model).toBe(GEMINI_FLASH_LITE);
      expect(tier.model[0].providerOptions.google.thinkingConfig).toEqual({
        thinkingBudget: 0,
      });
    });

    it("thinking → プライマリ FLASH + medium", () => {
      const tier = resolveModelTier({
        intent: "thinking",
        platform: "line",
        isAdmin: false,
      });
      expect(tier.model[0].model).toBe(GEMINI_FLASH);
      expect(
        tier.model[0].providerOptions.google.thinkingConfig.thinkingLevel,
      ).toBe("medium");
    });
  });

  describe("maxSteps", () => {
    it("casual はツール実行ループ上限 5", () => {
      const tier = resolveModelTier({
        intent: "casual",
        platform: "web",
        isAdmin: false,
      });
      expect(tier.defaultOptions.maxSteps).toBe(5);
    });

    it("thinking はツール実行ループ上限 10", () => {
      const tier = resolveModelTier({
        intent: "thinking",
        platform: "line",
        isAdmin: false,
      });
      expect(tier.defaultOptions.maxSteps).toBe(10);
    });
  });

  describe("フォールバック構成", () => {
    it("フォールバックはプライマリと同じ thinking 設定を引き継ぐ", () => {
      const tier = resolveModelTier({
        intent: "thinking",
        platform: "line",
        isAdmin: false,
      });
      expect(
        tier.model[1].providerOptions.google.thinkingConfig.thinkingLevel,
      ).toBe("medium");
    });

    it("全エントリに maxRetries が設定されている", () => {
      const tier = resolveModelTier({
        intent: "casual",
        platform: "web",
        isAdmin: false,
      });
      for (const entry of tier.model) {
        expect(entry.maxRetries).toBe(1);
      }
    });

    it("全エントリに id が明示されている（未指定だと randomUUID が workerd の起動を壊す）", () => {
      const tier = resolveModelTier({
        intent: "casual",
        platform: "web",
        isAdmin: false,
      });
      for (const entry of tier.model) {
        expect(entry.id).toBe(entry.model);
      }
    });
  });
});

describe("primaryModelId", () => {
  it("先頭エントリのモデル ID を返す", () => {
    const tier = resolveModelTier({
      intent: "casual",
      platform: "web",
      isAdmin: false,
    });
    expect(primaryModelId(tier)).toBe(GEMINI_FLASH_LITE);
  });
});
