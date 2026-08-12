import { describe, expect, it } from "vitest";
import {
  type Intent,
  OPENAI_LITE,
  OPENAI_MAIN,
  primaryModelId,
  resolveModelTier,
  voiceModelConfig,
} from "./llm-models";

describe("resolveModelTier", () => {
  describe("Admin は常に thinking/web ティア", () => {
    const intents: Intent[] = ["casual", "thinking"];
    const platforms = ["web", "line"] as const;

    for (const intent of intents) {
      for (const platform of platforms) {
        it(`intent=${intent}, platform=${platform} でもプライマリ MAIN + high`, () => {
          const tier = resolveModelTier({ intent, platform, isAdmin: true });
          expect(tier.model[0].model).toBe(OPENAI_MAIN);
          expect(
            tier.model[0].providerOptions.openai.reasoningEffort,
          ).toBe("high");
        });
      }
    }
  });

  describe("Web プラットフォーム（非 Admin）", () => {
    it("casual → プライマリ LITE + low、フォールバック MAIN", () => {
      const tier = resolveModelTier({
        intent: "casual",
        platform: "web",
        isAdmin: false,
      });
      expect(tier.model.map((m) => m.model)).toEqual([
        OPENAI_LITE,
        OPENAI_MAIN,
      ]);
      expect(tier.model[0].providerOptions.openai.reasoningEffort).toBe("low");
    });

    it("thinking → プライマリ MAIN + high、フォールバック LITE", () => {
      const tier = resolveModelTier({
        intent: "thinking",
        platform: "web",
        isAdmin: false,
      });
      expect(tier.model.map((m) => m.model)).toEqual([
        OPENAI_MAIN,
        OPENAI_LITE,
      ]);
      expect(tier.model[0].providerOptions.openai.reasoningEffort).toBe("high");
    });
  });

  describe("LINE プラットフォーム（非 Admin）", () => {
    it("casual → プライマリ LITE + minimal", () => {
      const tier = resolveModelTier({
        intent: "casual",
        platform: "line",
        isAdmin: false,
      });
      expect(tier.model[0].model).toBe(OPENAI_LITE);
      expect(tier.model[0].providerOptions.openai).toEqual({
        reasoningEffort: "minimal",
      });
    });

    it("thinking → プライマリ MAIN + medium", () => {
      const tier = resolveModelTier({
        intent: "thinking",
        platform: "line",
        isAdmin: false,
      });
      expect(tier.model[0].model).toBe(OPENAI_MAIN);
      expect(tier.model[0].providerOptions.openai.reasoningEffort).toBe(
        "medium",
      );
    });
  });

  describe("voiceModelConfig（通話用の固定モデル）", () => {
    it("プライマリ LITE + low、フォールバック MAIN", () => {
      expect(voiceModelConfig.model.map((m) => m.model)).toEqual([
        OPENAI_LITE,
        OPENAI_MAIN,
      ]);
      expect(
        voiceModelConfig.model[0].providerOptions.openai.reasoningEffort,
      ).toBe("low");
    });

    it("重い MAIN は使わない（軽量ゲート）", () => {
      expect(voiceModelConfig.model[0].model).not.toBe(OPENAI_MAIN);
    });

    it("tool 委譲のため maxSteps は 10 を維持", () => {
      expect(voiceModelConfig.defaultOptions.maxSteps).toBe(10);
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
    it("フォールバックはプライマリと同じ reasoning 設定を引き継ぐ", () => {
      const tier = resolveModelTier({
        intent: "thinking",
        platform: "line",
        isAdmin: false,
      });
      expect(tier.model[1].providerOptions.openai.reasoningEffort).toBe(
        "medium",
      );
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
    expect(primaryModelId(tier)).toBe(OPENAI_LITE);
  });
});
