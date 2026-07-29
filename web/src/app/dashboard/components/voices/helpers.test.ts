import { describe, expect, it } from "vitest";

import {
  activeChips,
  appliedCount,
  DEFAULT_FILTER,
  getSentimentStyle,
  groupVoicesByTopic,
  mergeVoices,
  periodRange,
  removeChip,
  sentimentLabel,
  shouldIncludeEmergencies,
  shouldIncludePersonas,
  toPersonaParams,
  type VoiceFilter,
} from "./helpers";

const filter = (overrides: Partial<VoiceFilter> = {}): VoiceFilter => ({
  ...DEFAULT_FILTER,
  ...overrides,
});

const persona = (overrides: Record<string, unknown> = {}) => ({
  id: "p-1",
  category: "complaint",
  tags: "ゴミ分別,案内",
  content: "粗大ごみの出し方がわかりにくい",
  source: "chat",
  topic: "生活",
  sentiment: "negative",
  demographicSummary: "40代,観光客",
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: null,
  conversationEndedAt: "2026-07-20T00:00:00Z",
  ...overrides,
});

const emergency = (overrides: Record<string, unknown> = {}) => ({
  id: "e-1",
  type: "熊の出没",
  description: "農道付近で子熊を目撃",
  location: "物満内",
  reportedAt: "2026-07-28T08:40:00Z",
  updatedAt: null,
  ...overrides,
});

// 2026-07-29（水）
const NOW = new Date("2026-07-29T10:00:00");

describe("periodRange", () => {
  it("week は今週月曜以降", () => {
    expect(periodRange("week", NOW)).toEqual({ from: "2026-07-27" });
  });

  it("m1 は 30 日前以降", () => {
    expect(periodRange("m1", NOW)).toEqual({ from: "2026-06-30" });
  });

  it("all は期間条件なし", () => {
    expect(periodRange("all", NOW)).toEqual({});
  });
});

describe("toPersonaParams", () => {
  it("フィルターを API パラメータに変換する", () => {
    const result = toPersonaParams(
      filter({
        period: "week",
        sents: ["negative", "request"],
        segs: ["観光客"],
        topic: "観光",
      }),
      NOW,
    );
    expect(result).toEqual({
      from: "2026-07-27",
      sentiments: ["negative", "request"],
      relationships: ["観光客"],
      topic: "観光",
    });
  });

  it("緊急は persona の sentiment に含めない", () => {
    const result = toPersonaParams(
      filter({ sents: ["negative", "emergency"] }),
      NOW,
    );
    expect(result.sentiments).toEqual(["negative"]);
  });

  it("未選択のグループはパラメータに含めない", () => {
    const result = toPersonaParams(filter(), NOW);
    expect(result).toEqual({ from: "2026-06-30" });
  });
});

describe("shouldIncludePersonas", () => {
  it("未選択なら含める", () => {
    expect(shouldIncludePersonas(filter())).toBe(true);
  });

  it("緊急だけ選んでいれば含めない", () => {
    expect(shouldIncludePersonas(filter({ sents: ["emergency"] }))).toBe(false);
  });

  it("緊急と他の感情を選んでいれば含める", () => {
    expect(
      shouldIncludePersonas(filter({ sents: ["emergency", "negative"] })),
    ).toBe(true);
  });
});

describe("sentimentLabel", () => {
  it("感情値を日本語ラベルにする（neutral は中立）", () => {
    expect(sentimentLabel("positive")).toBe("ポジティブ");
    expect(sentimentLabel("neutral")).toBe("中立");
  });
});

describe("shouldIncludeEmergencies", () => {
  it("どんな声か未選択なら含める", () => {
    expect(shouldIncludeEmergencies(filter())).toBe(true);
  });

  it("緊急を選んでいれば含める", () => {
    expect(shouldIncludeEmergencies(filter({ sents: ["emergency"] }))).toBe(
      true,
    );
  });

  it("緊急以外の感情だけ選んでいれば含めない", () => {
    expect(shouldIncludeEmergencies(filter({ sents: ["positive"] }))).toBe(
      false,
    );
  });

  it("誰の声か・話題で絞ると含めない（緊急には属性がない）", () => {
    expect(
      shouldIncludeEmergencies(filter({ sents: ["emergency"], segs: ["村人"] })),
    ).toBe(false);
    expect(
      shouldIncludeEmergencies(filter({ sents: ["emergency"], topic: "観光" })),
    ).toBe(false);
  });
});

describe("appliedCount / activeChips / removeChip", () => {
  it("初期状態は 0 個・チップなし", () => {
    expect(appliedCount(DEFAULT_FILTER)).toBe(0);
    expect(activeChips(DEFAULT_FILTER)).toEqual([]);
  });

  it("期間の変更・感情・属性・話題を数える", () => {
    const f = filter({
      period: "week",
      sents: ["negative", "emergency"],
      segs: ["観光客"],
      topic: "観光",
    });
    expect(appliedCount(f)).toBe(5);
    expect(activeChips(f).map((c) => c.label)).toEqual([
      "今週",
      "ネガティブ",
      "緊急",
      "📷 観光客",
      "観光",
    ]);
  });

  it("removeChip で個別解除できる（期間はデフォルトに戻る）", () => {
    const f = filter({
      period: "week",
      sents: ["negative", "emergency"],
      segs: ["観光客"],
      topic: "観光",
    });
    const chips = activeChips(f);

    let next = removeChip(f, chips[0].key);
    expect(next.period).toBe("m1");

    next = removeChip(f, "sent:negative");
    expect(next.sents).toEqual(["negative", "emergency"].slice(1));

    next = removeChip(f, "seg:観光客");
    expect(next.segs).toEqual([]);

    next = removeChip(f, "topic");
    expect(next.topic).toBeNull();
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

  it("ペルソナの属性タグに demographicSummary と tags を含む", () => {
    const [voice] = mergeVoices([persona()], []);
    if (voice.kind !== "persona") throw new Error("unexpected kind");
    expect(voice.attributes).toEqual(["40代", "観光客", "ゴミ分別", "案内"]);
  });

  it("期間外の緊急は含めない", () => {
    const voices = mergeVoices(
      [],
      [emergency({ reportedAt: "2026-06-01T00:00:00Z" })],
      { period: "m1", now: NOW },
    );
    expect(voices).toEqual([]);
  });
});

describe("groupVoicesByTopic", () => {
  it("話題ごとに件数降順でまとめ、代表的な声を先頭から取る", () => {
    const voices = mergeVoices(
      [
        persona({ id: "p-1", topic: "生活", sentiment: "negative" }),
        persona({
          id: "p-2",
          topic: "生活",
          sentiment: "request",
          content: "分別表がほしい",
        }),
        persona({ id: "p-3", topic: "観光", sentiment: "positive" }),
        persona({ id: "p-4", topic: null, sentiment: "neutral" }),
      ],
      [emergency()],
    );
    const groups = groupVoicesByTopic(voices);

    expect(groups[0].topic).toBe("生活");
    expect(groups[0].count).toBe(2);
    expect(groups[0].sample).toBe("粗大ごみの出し方がわかりにくい");
    expect(groups[0].sentiments.negative).toBe(1);
    expect(groups[0].sentiments.request).toBe(1);

    expect(groups.map((g) => g.topic)).toContain("緊急");
    expect(groups.map((g) => g.topic)).toContain("その他");
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
