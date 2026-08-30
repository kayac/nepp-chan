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
  it("OpenAI Luna を medium reasoning で使用する", async () => {
    const agent = createWebResearcherAgent();
    const model = await agent.getModel();
    const options = await agent.getDefaultOptions();

    expect(model.provider).toContain("openai");
    expect(model.modelId).toBe("gpt-5.6-luna");
    expect(options.providerOptions).toMatchObject({
      openai: { reasoningEffort: "medium" },
    });
  });

  it("OpenAI Web Searchを使用する", async () => {
    const tools = await createWebResearcherAgent().listTools();
    expect(Object.keys(tools)).toEqual(["webSearch"]);
  });

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

  it("正確な値は公式資料本体を確認し、調査メモだけを返す", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain("公式資料本体");
    expect(ins).toContain("具体的な値を取得できるまで");
    expect(ins).toContain("ユーザー向けの文章に整えない");
    expect(ins).toContain("簡潔な調査メモ");
  });
});
