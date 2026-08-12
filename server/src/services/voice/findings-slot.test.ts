import { describe, expect, it } from "vitest";
import {
  createVoiceFindingsSlot,
  hasVoiceFindings,
  pushVoiceFindings,
  type VoiceFindings,
} from "./findings-slot";

const findings = (query: string, chars = 10): VoiceFindings => ({
  query,
  source: "knowledge",
  text: "あ".repeat(chars),
});

describe("hasVoiceFindings", () => {
  it("undefined・空スロットは false、1件以上で true", () => {
    expect(hasVoiceFindings(undefined)).toBe(false);
    expect(hasVoiceFindings(createVoiceFindingsSlot())).toBe(false);

    const slot = createVoiceFindingsSlot();
    pushVoiceFindings(slot, findings("そば"));
    expect(hasVoiceFindings(slot)).toBe(true);
  });
});

describe("pushVoiceFindings", () => {
  it("通話中の検索結果を到着順に貯める", () => {
    const slot = createVoiceFindingsSlot();
    pushVoiceFindings(slot, findings("そば"));
    pushVoiceFindings(slot, findings("郵便局"));

    expect(slot.entries.map((e) => e.query)).toEqual(["そば", "郵便局"]);
  });

  it("件数上限を超えたら古いものから捨てる", () => {
    const slot = createVoiceFindingsSlot();
    for (let i = 0; i < 10; i++) {
      pushVoiceFindings(slot, findings(`質問${i}`));
    }

    expect(slot.entries).toHaveLength(8);
    expect(slot.entries[0].query).toBe("質問2");
    expect(slot.entries.at(-1)?.query).toBe("質問9");
  });

  it("総文字数上限を超えたら古いものから捨てる", () => {
    const slot = createVoiceFindingsSlot();
    pushVoiceFindings(slot, findings("古い", 3000));
    pushVoiceFindings(slot, findings("新しい", 1500));

    expect(slot.entries.map((e) => e.query)).toEqual(["新しい"]);
  });

  it("1件で上限を超える資料は保存せず、既存の資料も捨てない", () => {
    const slot = createVoiceFindingsSlot();
    pushVoiceFindings(slot, findings("既存"));
    pushVoiceFindings(slot, findings("巨大", 5000));

    expect(slot.entries.map((e) => e.query)).toEqual(["既存"]);
  });
});
