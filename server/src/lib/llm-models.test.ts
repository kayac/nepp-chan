import { describe, expect, it } from "vitest";
import {
  GEMINI_FLASH_EVAL,
  modelWithReasoning,
  OPENAI_LITE,
  OPENAI_MAIN,
  primaryModelId,
  resolveModelTier,
  voiceModelConfig,
} from "./llm-models";

describe("modelWithReasoning", () => {
  it("google 系モデルにも reasoning 指定が効くよう両プロバイダの providerOptions を持つ", () => {
    const config = modelWithReasoning({
      model: GEMINI_FLASH_EVAL,
      effort: "medium",
    });
    expect(config.defaultOptions.providerOptions.openai.reasoningEffort).toBe(
      "medium",
    );
    expect(
      config.defaultOptions.providerOptions.google.thinkingConfig.thinkingLevel,
    ).toBe("medium");
  });

  it("Agent 直下の providerOptions は捨てられるため defaultOptions に入れる", () => {
    expect(modelWithReasoning({ effort: "medium" })).not.toHaveProperty(
      "providerOptions",
    );
  });

  it("model 省略時は LITE を使う", () => {
    expect(modelWithReasoning({ effort: "medium" }).model).toBe(OPENAI_LITE);
  });

  it("Gemini の thinkingLevel に none が無いため minimal へ読み替える", () => {
    const config = modelWithReasoning({ effort: "none" });

    expect(config.defaultOptions.providerOptions.openai.reasoningEffort).toBe(
      "none",
    );
    expect(
      config.defaultOptions.providerOptions.google.thinkingConfig.thinkingLevel,
    ).toBe("minimal");
  });

  it("Gemini の thinkingLevel に xhigh が無いため high へ丸める", () => {
    const config = modelWithReasoning({ effort: "xhigh" });

    expect(config.defaultOptions.providerOptions.openai.reasoningEffort).toBe(
      "xhigh",
    );
    expect(
      config.defaultOptions.providerOptions.google.thinkingConfig.thinkingLevel,
    ).toBe("high");
  });
});

describe("resolveModelTier", () => {
  describe("Admin は thinking の reasoning と casual の maxSteps を引き上げる", () => {
    const platforms = ["web", "line"] as const;

    for (const platform of platforms) {
      it(`casual/${platform} は effort=none のまま maxSteps だけ thinking と揃える`, () => {
        const tier = resolveModelTier({
          intent: "casual",
          platform,
          isAdmin: true,
        });
        expect(tier.model[0].providerOptions.openai.reasoningEffort).toBe(
          "none",
        );
        expect(tier.defaultOptions.maxSteps).toBe(
          resolveModelTier({ intent: "thinking", platform, isAdmin: false })
            .defaultOptions.maxSteps,
        );
      });

      it(`thinking/${platform} は effort=high`, () => {
        const tier = resolveModelTier({
          intent: "thinking",
          platform,
          isAdmin: true,
        });
        for (const entry of tier.model) {
          expect(entry.providerOptions.openai.reasoningEffort).toBe("high");
        }
      });
    }
  });

  describe("Web プラットフォーム（非 Admin）", () => {
    it("casual → プライマリ LITE + none、フォールバック MAIN", () => {
      const tier = resolveModelTier({
        intent: "casual",
        platform: "web",
        isAdmin: false,
      });
      expect(tier.model.map((m) => m.model)).toEqual([
        OPENAI_LITE,
        OPENAI_MAIN,
      ]);
      expect(tier.model[0].providerOptions.openai.reasoningEffort).toBe("none");
    });

    it("thinking → プライマリ LITE + medium、フォールバック MAIN", () => {
      const tier = resolveModelTier({
        intent: "thinking",
        platform: "web",
        isAdmin: false,
      });
      expect(tier.model.map((m) => m.model)).toEqual([
        OPENAI_LITE,
        OPENAI_MAIN,
      ]);
      expect(tier.model[0].providerOptions.openai.reasoningEffort).toBe(
        "medium",
      );
      expect(tier.model[0].providerOptions.openai.textVerbosity).toBe("high");
    });
  });

  describe("LINE プラットフォーム（非 Admin）", () => {
    it("casual → プライマリ LITE + none", () => {
      const tier = resolveModelTier({
        intent: "casual",
        platform: "line",
        isAdmin: false,
      });
      expect(tier.model[0].model).toBe(OPENAI_LITE);
      expect(tier.model[0].providerOptions.openai).toEqual({
        reasoningEffort: "none",
      });
    });

    it("thinking → プライマリ LITE + medium", () => {
      const tier = resolveModelTier({
        intent: "thinking",
        platform: "line",
        isAdmin: false,
      });
      expect(tier.model[0].model).toBe(OPENAI_LITE);
      expect(tier.model[0].providerOptions.openai.reasoningEffort).toBe(
        "medium",
      );
      expect(tier.model[0].providerOptions.openai).not.toHaveProperty(
        "textVerbosity",
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
