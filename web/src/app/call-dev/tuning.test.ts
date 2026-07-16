import { beforeEach, describe, expect, it } from "vitest";
import {
  buildElevenLabsVoice,
  loadStoredTuning,
  parseElevenLabsVoice,
  saveTuning,
  TUNING_STORAGE_KEY,
  toConnectParams,
} from "./tuning";

describe("buildElevenLabsVoice", () => {
  it("voiceId のみを合成できる", () => {
    expect(buildElevenLabsVoice({ voiceId: "8EkOjt4xTPGMclNlh1pk" })).toBe(
      "8EkOjt4xTPGMclNlh1pk",
    );
  });

  it("voiceId-model を合成できる", () => {
    expect(
      buildElevenLabsVoice({
        voiceId: "8EkOjt4xTPGMclNlh1pk",
        model: "flash_v2_5",
      }),
    ).toBe("8EkOjt4xTPGMclNlh1pk-flash_v2_5");
  });

  it("voiceId-model-speed_stability_similarity を合成できる", () => {
    expect(
      buildElevenLabsVoice({
        voiceId: "abc123",
        model: "flash_v2_5",
        speed: "1.1",
        stability: "0.5",
        similarity: "0.8",
      }),
    ).toBe("abc123-flash_v2_5-1.1_0.5_0.8");
  });

  it("音声設定が一部でも欠けている場合は設定部を付けない", () => {
    expect(
      buildElevenLabsVoice({
        voiceId: "abc123",
        model: "flash_v2_5",
        speed: "1.1",
      }),
    ).toBe("abc123-flash_v2_5");
  });
});

describe("parseElevenLabsVoice", () => {
  it("voiceId のみを分解できる", () => {
    expect(parseElevenLabsVoice("8EkOjt4xTPGMclNlh1pk")).toEqual({
      voiceId: "8EkOjt4xTPGMclNlh1pk",
    });
  });

  it("voiceId-model を分解できる", () => {
    expect(parseElevenLabsVoice("8EkOjt4xTPGMclNlh1pk-flash_v2_5")).toEqual({
      voiceId: "8EkOjt4xTPGMclNlh1pk",
      model: "flash_v2_5",
    });
  });

  it("model を伴わない設定部は model として扱い、build と往復できる", () => {
    const parsed = parseElevenLabsVoice("abc123-1.0_0.5_0.8");
    expect(parsed).toEqual({ voiceId: "abc123", model: "1.0_0.5_0.8" });
    expect(buildElevenLabsVoice(parsed)).toBe("abc123-1.0_0.5_0.8");
  });

  it("voiceId-model-設定部を分解でき、build と往復できる", () => {
    const parsed = parseElevenLabsVoice("abc123-flash_v2_5-1.1_0.5_0.8");
    expect(parsed).toEqual({
      voiceId: "abc123",
      model: "flash_v2_5",
      speed: "1.1",
      stability: "0.5",
      similarity: "0.8",
    });
    expect(buildElevenLabsVoice(parsed)).toBe("abc123-flash_v2_5-1.1_0.5_0.8");
  });
});

describe("toConnectParams", () => {
  const defaults = {
    voicePreset: "morioki",
    speechTimeout: "600",
    fillerEnabled: "true",
  };

  it("既定値と異なる項目だけを返す", () => {
    const params = toConnectParams(
      { voicePreset: "leda", speechTimeout: "600", fillerEnabled: "false" },
      defaults,
    );
    expect(params).toEqual({ voicePreset: "leda", fillerEnabled: "false" });
  });

  it("全て既定値なら空オブジェクトを返す", () => {
    expect(toConnectParams({ ...defaults }, defaults)).toEqual({});
  });

  it("defaults にないキーは送らない", () => {
    expect(toConnectParams({ unknown: "x", ...defaults }, defaults)).toEqual(
      {},
    );
  });
});

describe("loadStoredTuning / saveTuning", () => {
  const defaults = { voicePreset: "morioki", speechTimeout: "600" };

  beforeEach(() => {
    localStorage.clear();
  });

  it("保存した値を defaults にマージして復元する", () => {
    saveTuning({ voicePreset: "leda" });
    expect(loadStoredTuning(defaults)).toEqual({
      voicePreset: "leda",
      speechTimeout: "600",
    });
  });

  it("保存データが無ければ defaults を返す", () => {
    expect(loadStoredTuning(defaults)).toEqual(defaults);
  });

  it("壊れた保存データは defaults にフォールバックする", () => {
    localStorage.setItem(TUNING_STORAGE_KEY, "{broken json");
    expect(loadStoredTuning(defaults)).toEqual(defaults);
  });

  it("defaults に存在しないキーは復元時に捨てる", () => {
    localStorage.setItem(
      TUNING_STORAGE_KEY,
      JSON.stringify({ stale: "x", speechTimeout: "800" }),
    );
    expect(loadStoredTuning(defaults)).toEqual({
      voicePreset: "morioki",
      speechTimeout: "800",
    });
  });
});
