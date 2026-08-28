import { describe, expect, it } from "vitest";

import { createWebResearcherAgent } from "./web-researcher-agent";

const instructionsOf = async () =>
  String(
    await (
      createWebResearcherAgent() as unknown as {
        getInstructions: (a?: unknown) => Promise<string>;
      }
    ).getInstructions({}),
  );

describe("createWebResearcherAgent", () => {
  it("未確定情報を省かず、確度を保って伝える", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain("情報は確度を保って伝える");
    expect(ins).toContain("有用な未確定情報まで省かない");
    expect(ins).not.toContain("予定や見込みも、確定情報と区別して伝える");
  });

  it("現在性が回答に影響するときだけ情報の時点を考慮する", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain("情報の現在性が回答に影響する場合");
    expect(ins).toContain("最新状況を確認できない場合");
    expect(ins).toContain("必要に応じて直接確認を案内する");
    expect(ins).not.toContain(
      "検索結果の年度・日付が古い場合は「最新情報は直接確認をおすすめします」",
    );
  });
});
