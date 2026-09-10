import { describe, expect, it } from "vitest";
import { personaCases } from "./cases";
import { fixtures } from "./fixtures";
import { aspectOf, personaCaseMetaSchema } from "./schema";
import { snapshotFor } from "./snapshots";

describe("personaCases", () => {
  it("全ケースがスキーマに適合し、id が一意である", () => {
    for (const c of personaCases) {
      expect(() => personaCaseMetaSchema.parse(c), c.id).not.toThrow();
      expect(c.gates.length, c.id).toBeGreaterThan(0);
    }
    const ids = personaCases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fixture 参照が存在し、gate の id が code: / judge: / check- で始まる", () => {
    for (const c of personaCases) {
      if (c.fixture) expect(c.fixture in fixtures, c.id).toBe(true);
      for (const g of c.gates)
        expect(g.id, c.id).toMatch(/^(code:|judge:|check-)/);
    }
  });

  it("スナップショットのある web ケースは比較 gate を持ち、表層以外の観点を 1 つ以上見る", () => {
    for (const c of personaCases.filter((c) => c.platform === "web")) {
      const ids = c.gates.map((g) => g.id);
      if (snapshotFor(c.id))
        expect(ids, c.id).toContain("code:close-to-snapshot");
      expect(
        ids.map(aspectOf).some((a) => a !== "S"),
        c.id,
      ).toBe(true);
    }
  });

  it("voice のケースは絵文字禁止、line のケースは Markdown 禁止を gate に持つ", () => {
    for (const c of personaCases) {
      const ids = c.gates.map((g) => g.id);
      if (c.platform === "voice") expect(ids, c.id).toContain("code:no-emoji");
      if (c.platform === "line")
        expect(ids, c.id).toContain("code:no-markdown");
    }
  });
});
