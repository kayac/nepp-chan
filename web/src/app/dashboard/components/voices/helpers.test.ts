import { TOPICS } from "@nepp-chan/shared/lib/persona-attributes";
import { describe, expect, it } from "vitest";

import {
  activeChips,
  analyzeContextLabel,
  appliedCount,
  DEFAULT_FILTER,
  removeChip,
  shouldIncludeEmergencies,
  shouldIncludePersonas,
  TOPIC_OPTIONS,
  toPersonaFilters,
  type VoiceFilter,
} from "./helpers";

const filter = (overrides: Partial<VoiceFilter> = {}): VoiceFilter => ({
  ...DEFAULT_FILTER,
  ...overrides,
});

// 2026-08-03（月）
const NOW = new Date("2026-08-03T10:00:00");

describe("TOPIC_OPTIONS", () => {
  it("表示順は違っても値は TOPICS と一致する", () => {
    expect([...TOPIC_OPTIONS].sort()).toEqual([...TOPICS].sort());
  });
});

describe("toPersonaFilters", () => {
  it("期間・感情・話題を API パラメータに変換する", () => {
    expect(
      toPersonaFilters(
        filter({
          period: "d7",
          sents: ["negative", "request"],
          topic: "観光",
        }),
        NOW,
      ),
    ).toEqual({
      from: "2026-07-28",
      sentiments: ["negative", "request"],
      topic: "観光",
    });
  });

  it("緊急はペルソナの感情に含めない", () => {
    expect(
      toPersonaFilters(filter({ sents: ["negative", "emergency"] }), NOW)
        .sentiments,
    ).toEqual(["negative"]);
  });

  it("緊急だけなら感情条件を送らない", () => {
    expect(
      toPersonaFilters(filter({ sents: ["emergency"] }), NOW).sentiments,
    ).toBeUndefined();
  });

  it("未選択のグループはパラメータに含めない", () => {
    expect(toPersonaFilters(filter(), NOW)).toEqual({ from: "2026-07-05" });
  });

  it("全期間は期間条件を送らない", () => {
    expect(toPersonaFilters(filter({ period: "all" }), NOW)).toEqual({});
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

  it("話題で絞ると含めない（緊急に話題は付かない）", () => {
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

  it("期間の変更・感情・話題を数える", () => {
    const f = filter({
      period: "d7",
      sents: ["negative", "emergency"],
      topic: "観光",
    });
    expect(appliedCount(f)).toBe(4);
    expect(activeChips(f).map((c) => c.label)).toEqual([
      "直近7日",
      "ネガティブ",
      "緊急",
      "観光",
    ]);
  });

  it("removeChip で個別解除できる（期間はデフォルトに戻る）", () => {
    const f = filter({
      period: "d7",
      sents: ["negative", "emergency"],
      topic: "観光",
    });

    expect(removeChip(f, activeChips(f)[0].key).period).toBe("m1");
    expect(removeChip(f, "sent:negative").sents).toEqual(["emergency"]);
    expect(removeChip(f, "topic").topic).toBeNull();
  });

  it("未知のキーは何も変えない", () => {
    const f = filter({ topic: "観光" });
    expect(removeChip(f, "unknown")).toEqual(f);
  });
});

describe("analyzeContextLabel", () => {
  it("期間 × 条件 × 件数のラベルを作る", () => {
    expect(
      analyzeContextLabel(filter({ period: "d7", sents: ["negative"] }), 12),
    ).toBe("直近7日 × ネガティブ・12件");
  });

  it("条件なしなら期間と件数だけ", () => {
    expect(analyzeContextLabel(filter(), 34)).toBe("直近30日・34件");
  });
});
