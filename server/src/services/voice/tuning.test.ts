import { describe, expect, it } from "vitest";
import { bridgeFieldSchemas } from "./bridge-config";
import {
  DEFAULT_VOICE_PRESET,
  parseVoiceTuning,
  relayFieldSchemas,
  VOICE_PRESETS,
  VOICE_TUNING_DEFAULTS,
} from "./tuning";

describe("parseVoiceTuning", () => {
  it("voicePreset でプリセットの ttsProvider/voice を解決する", () => {
    const { relay } = parseVoiceTuning({ voicePreset: "leda" });
    expect(relay.ttsProvider).toBe("Google");
    expect(relay.voice).toBe("ja-JP-Chirp3-HD-Leda");
  });

  it("不明な voicePreset は既定プリセットに落とし invalidKeys に含める", () => {
    const { relay, invalidKeys } = parseVoiceTuning({ voicePreset: "nope" });
    expect(relay.voice).toBe(VOICE_PRESETS[DEFAULT_VOICE_PRESET].voice);
    expect(invalidKeys).toContain("voicePreset");
  });

  it("明示的な ttsProvider/voice はプリセットより優先する", () => {
    const { relay } = parseVoiceTuning({
      voicePreset: "leda",
      ttsProvider: "ElevenLabs",
      voice: "abc123-flash_v2_5-1.0_0.5_0.8",
    });
    expect(relay.ttsProvider).toBe("ElevenLabs");
    expect(relay.voice).toBe("abc123-flash_v2_5-1.0_0.5_0.8");
  });

  it("speechTimeout は auto と 600〜5000 を受け付ける", () => {
    expect(
      parseVoiceTuning({ speechTimeout: "auto" }).relay.speechTimeout,
    ).toBe("auto");
    expect(parseVoiceTuning({ speechTimeout: "600" }).relay.speechTimeout).toBe(
      "600",
    );
    expect(
      parseVoiceTuning({ speechTimeout: "5000" }).relay.speechTimeout,
    ).toBe("5000");
  });

  it("speechTimeout の範囲外は既定値へフォールバックし invalidKeys に含める", () => {
    for (const value of ["599", "5001", "abc"]) {
      const { relay, invalidKeys } = parseVoiceTuning({ speechTimeout: value });
      expect(relay.speechTimeout).toBe("600");
      expect(invalidKeys).toContain("speechTimeout");
    }
  });

  it("eotThreshold は 0.5〜0.9 を文字列で受け付け、範囲外は無視する", () => {
    expect(parseVoiceTuning({ eotThreshold: "0.5" }).relay.eotThreshold).toBe(
      "0.5",
    );
    expect(parseVoiceTuning({ eotThreshold: "0.9" }).relay.eotThreshold).toBe(
      "0.9",
    );
    for (const value of ["0.4", "0.95", "x"]) {
      const { relay, invalidKeys } = parseVoiceTuning({ eotThreshold: value });
      expect(relay.eotThreshold).toBeUndefined();
      expect(invalidKeys).toContain("eotThreshold");
    }
  });

  it("bool パラメータは文字列 true/false を boolean に変換する", () => {
    const { relay } = parseVoiceTuning({
      partialPrompts: "false",
      dtmfDetection: "true",
      preemptible: "true",
    });
    expect(relay.partialPrompts).toBe(false);
    expect(relay.dtmfDetection).toBe(true);
    expect(relay.preemptible).toBe(true);
  });

  it("enum の不正値は既定値へフォールバックし invalidKeys に含める", () => {
    const { relay, invalidKeys } = parseVoiceTuning({
      interruptible: "loud",
      interruptSensitivity: "max",
    });
    expect(relay.interruptible).toBe("speech");
    expect(relay.interruptSensitivity).toBeUndefined();
    expect(invalidKeys).toEqual(
      expect.arrayContaining(["interruptible", "interruptSensitivity"]),
    );
  });

  it("voice は英数と ._- 以外を拒否する（XML 注入対策）", () => {
    const { relay, invalidKeys } = parseVoiceTuning({
      voice: '"><Say>hacked</Say>',
    });
    expect(relay.voice).toBe(VOICE_PRESETS[DEFAULT_VOICE_PRESET].voice);
    expect(invalidKeys).toContain("voice");
  });

  it("welcomeGreeting は空文字で挨拶なしにできる", () => {
    const { relay, invalidKeys } = parseVoiceTuning({ welcomeGreeting: "" });
    expect(relay.welcomeGreeting).toBe("");
    expect(invalidKeys).toEqual([]);
  });

  it("制御文字を含む自由テキストは拒否して既定値へフォールバックする", () => {
    const { relay, invalidKeys } = parseVoiceTuning({
      welcomeGreeting: "やあ\x00",
      hints: "音威子府\x07",
    });
    expect(relay.welcomeGreeting).toBe(
      "もしもし、ねっぷちゃんだよ。なんでも聞いてね。",
    );
    expect(relay.hints).toBe("音威子府,おといねっぷ");
    expect(invalidKeys).toEqual(
      expect.arrayContaining(["welcomeGreeting", "hints"]),
    );
  });

  it("bridge 系キーは bridge に分配される", () => {
    const { bridge } = parseVoiceTuning({
      fillerEnabled: "false",
      aizuchiCooldownMs: "4000",
    });
    expect(bridge.fillerEnabled).toBe(false);
    expect(bridge.aizuchiCooldownMs).toBe(4000);
  });
});

describe("VOICE_TUNING_DEFAULTS", () => {
  it("全スキーマキーを網羅する（欠けると web から送信不能になる）", () => {
    const schemaKeys = [
      ...Object.keys(relayFieldSchemas),
      ...Object.keys(bridgeFieldSchemas),
      "voicePreset",
    ];
    for (const key of schemaKeys) {
      expect(VOICE_TUNING_DEFAULTS).toHaveProperty(key);
    }
  });
});
