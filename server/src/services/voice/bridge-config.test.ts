import { describe, expect, it } from "vitest";
import {
  BRIDGE_CONFIG_DEFAULTS,
  parseBridgeConfig,
  serializeBridgeConfig,
} from "./bridge-config";

describe("parseBridgeConfig", () => {
  it("引数なし・空オブジェクトでは既定値を返す", () => {
    expect(parseBridgeConfig(undefined)).toEqual(BRIDGE_CONFIG_DEFAULTS);
    expect(parseBridgeConfig({})).toEqual(BRIDGE_CONFIG_DEFAULTS);
  });

  it("文字列の true/false を boolean に変換する", () => {
    const config = parseBridgeConfig({
      fillerEnabled: "false",
      aizuchiEnabled: "false",
      holdAudioEnabled: "false",
    });
    expect(config.fillerEnabled).toBe(false);
    expect(config.aizuchiEnabled).toBe(false);
    expect(config.holdAudioEnabled).toBe(false);
  });

  it("aizuchiCooldownMs は範囲内の値を数値として受け取る", () => {
    expect(
      parseBridgeConfig({ aizuchiCooldownMs: "500" }).aizuchiCooldownMs,
    ).toBe(500);
    expect(
      parseBridgeConfig({ aizuchiCooldownMs: "30000" }).aizuchiCooldownMs,
    ).toBe(30000);
  });

  it("aizuchiCooldownMs の範囲外・非数値は既定値へフォールバックする", () => {
    for (const value of ["499", "30001", "abc", ""]) {
      expect(
        parseBridgeConfig({ aizuchiCooldownMs: value }).aizuchiCooldownMs,
      ).toBe(BRIDGE_CONFIG_DEFAULTS.aizuchiCooldownMs);
    }
  });

  it("holdAudioUrl は https のみ受け付け、それ以外は既定値へフォールバックする", () => {
    expect(
      parseBridgeConfig({ holdAudioUrl: "https://example.com/hold.mp3" })
        .holdAudioUrl,
    ).toBe("https://example.com/hold.mp3");
    for (const value of ["http://example.com/hold.mp3", "not-a-url", ""]) {
      expect(parseBridgeConfig({ holdAudioUrl: value }).holdAudioUrl).toBe(
        BRIDGE_CONFIG_DEFAULTS.holdAudioUrl,
      );
    }
  });

  it("未知のキー（token 等）は無視する", () => {
    expect(parseBridgeConfig({ token: "jwt", unknown: "x" })).toEqual(
      BRIDGE_CONFIG_DEFAULTS,
    );
  });
});

describe("parseBridgeConfig: 遅延ノブ", () => {
  it("fillerDelayMs / holdDelayMs は 0〜5000 を受け付ける", () => {
    const config = parseBridgeConfig({
      fillerDelayMs: "500",
      holdDelayMs: "5000",
    });
    expect(config.fillerDelayMs).toBe(500);
    expect(config.holdDelayMs).toBe(5000);
  });

  it("範囲外・非数値は既定値（0）へフォールバックする", () => {
    for (const value of ["-1", "5001", "abc"]) {
      expect(parseBridgeConfig({ fillerDelayMs: value }).fillerDelayMs).toBe(0);
      expect(parseBridgeConfig({ holdDelayMs: value }).holdDelayMs).toBe(0);
    }
  });
});

describe("parseBridgeConfig: 文言カスタム", () => {
  it("カンマ区切りをトリムして配列にする", () => {
    const config = parseBridgeConfig({
      thinkingFillers: "えっとね, どれどれ",
      backchannelFillers: "ふむふむ",
      aizuchiPhrases: "はい,ええ, うん",
    });
    expect(config.thinkingFillers).toEqual(["えっとね", "どれどれ"]);
    expect(config.backchannelFillers).toEqual(["ふむふむ"]);
    expect(config.aizuchiPhrases).toEqual(["はい", "ええ", "うん"]);
  });

  it("空要素は除外する", () => {
    expect(
      parseBridgeConfig({ aizuchiPhrases: "うん,,ええ," }).aizuchiPhrases,
    ).toEqual(["うん", "ええ"]);
  });

  it("全て空・1フレーズ20文字超・11個以上は既定値へフォールバックする", () => {
    for (const value of [
      ",,,",
      "あ".repeat(21),
      Array.from({ length: 11 }, (_, i) => `フレーズ${i}`).join(","),
    ]) {
      expect(
        parseBridgeConfig({ aizuchiPhrases: value }).aizuchiPhrases,
      ).toEqual(BRIDGE_CONFIG_DEFAULTS.aizuchiPhrases);
    }
  });
});

describe("parseBridgeConfig: 自動終話", () => {
  it("endCallEnabled は既定 true で false に切り替えられる", () => {
    expect(parseBridgeConfig({}).endCallEnabled).toBe(true);
    expect(parseBridgeConfig({ endCallEnabled: "false" }).endCallEnabled).toBe(
      false,
    );
  });
});

describe("serializeBridgeConfig", () => {
  it("全フィールドを string 化し、parseBridgeConfig で往復できる", () => {
    const config = {
      fillerEnabled: false,
      fillerDelayMs: 800,
      thinkingFillers: ["えっとね", "どれどれ"],
      backchannelFillers: ["ふむふむ"],
      aizuchiEnabled: true,
      aizuchiCooldownMs: 4500,
      aizuchiPhrases: ["はい", "ええ"],
      holdAudioEnabled: false,
      holdAudioUrl: "https://example.com/hold.mp3",
      holdDelayMs: 1200,
      endCallEnabled: false,
    };
    const serialized = serializeBridgeConfig(config);
    expect(Object.values(serialized).every((v) => typeof v === "string")).toBe(
      true,
    );
    expect(parseBridgeConfig(serialized)).toEqual(config);
  });
});
