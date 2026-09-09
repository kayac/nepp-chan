import { beforeAll, describe, expect, it } from "vitest";
import { personaCases } from "./cases";
import { loadDevVars } from "./dev-vars";
import { evaluateCase } from "./runner";

const onlyCode = process.env.NEPPCHAN_ONLY_CODE === "1";
const platform = process.env.NEPPCHAN_PLATFORM;
const selected = personaCases.filter((c) =>
  platform ? c.platform === platform : c.platform !== "voice",
);

describe.concurrent("ねっぷちゃんらしさ", () => {
  beforeAll(() => loadDevVars());

  for (const c of selected) {
    it(c.id, async () => {
      const outcome = await evaluateCase(c, 1, onlyCode);
      expect(outcome.error).toBeUndefined();
      const failed = outcome.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.reason ?? ""}`);
      expect(failed, outcome.text).toEqual([]);
    });
  }
});
