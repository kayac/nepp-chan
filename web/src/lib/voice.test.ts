import { describe, expect, it } from "vitest";

import {
  getSentimentStyle,
  mergeVoices,
  personaDate,
  sentimentLabel,
} from "./voice";

const persona = (overrides: Record<string, unknown> = {}) => ({
  id: "p-1",
  tags: "ゴミ分別,案内",
  content: "粗大ごみの出し方がわかりにくい",
  topic: "生活",
  sentiment: "negative",
  demographicSummary: "40代,観光客",
  createdAt: "2026-07-01T00:00:00Z",
  conversationEndedAt: "2026-07-20T00:00:00Z",
  ...overrides,
});

const emergency = (overrides: Record<string, unknown> = {}) => ({
  id: "e-1",
  type: "熊の出没",
  description: "農道付近で子熊を目撃",
  location: "物満内",
  reportedAt: "2026-07-28T08:40:00Z",
  ...overrides,
});

describe("personaDate", () => {
  it("会話終了時刻を優先し、なければ createdAt", () => {
    expect(
      personaDate({
        createdAt: "2026-07-01T00:00:00Z",
        conversationEndedAt: "2026-07-20T00:00:00Z",
      }),
    ).toBe("2026-07-20T00:00:00Z");
    expect(
      personaDate({
        createdAt: "2026-07-01T00:00:00Z",
        conversationEndedAt: null,
      }),
    ).toBe("2026-07-01T00:00:00Z");
  });
});

describe("mergeVoices", () => {
  it("ペルソナと緊急を日時降順で混ぜる", () => {
    const voices = mergeVoices(
      [
        persona({ id: "p-1", conversationEndedAt: "2026-07-20T00:00:00Z" }),
        persona({
          id: "p-2",
          conversationEndedAt: null,
          createdAt: "2026-07-29T00:00:00Z",
        }),
      ],
      [emergency({ id: "e-1", reportedAt: "2026-07-28T08:40:00Z" })],
    );
    expect(voices.map((v) => v.id)).toEqual(["p-2", "e-1", "p-1"]);
    expect(voices[1].kind).toBe("emergency");
  });

  it("属性タグに demographicSummary と tags を含む", () => {
    const [voice] = mergeVoices([persona()], []);
    if (voice.kind !== "persona") throw new Error("unexpected kind");
    expect(voice.attributes).toEqual(["40代", "観光客", "ゴミ分別", "案内"]);
  });

  it("説明のない緊急は種別だけを本文にする", () => {
    const [voice] = mergeVoices([], [emergency({ description: null })]);
    expect(voice.content).toBe("熊の出没");
  });
});

describe("sentimentLabel", () => {
  it("感情値を日本語ラベルにする（neutral は中立）", () => {
    expect(sentimentLabel("positive")).toBe("ポジティブ");
    expect(sentimentLabel("neutral")).toBe("中立");
  });

  it("未知の値はそのまま返す", () => {
    expect(sentimentLabel("unknown")).toBe("unknown");
  });
});

describe("getSentimentStyle", () => {
  it("null や空文字なら空文字", () => {
    expect(getSentimentStyle(null)).toBe("");
    expect(getSentimentStyle("")).toBe("");
  });

  it("positive は緑系", () => {
    expect(getSentimentStyle("positive")).toBe("bg-green-50 text-green-700");
  });

  it("negative は赤系", () => {
    expect(getSentimentStyle("negative")).toBe("bg-red-50 text-red-700");
  });

  it("request はアンバー系", () => {
    expect(getSentimentStyle("request")).toBe("bg-amber-50 text-amber-700");
  });

  it("未知の値は stone デフォルト", () => {
    expect(getSentimentStyle("unknown")).toBe("bg-stone-100 text-stone-600");
  });
});
