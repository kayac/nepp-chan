import { describe, expect, it } from "vitest";

import { createKnowledgeAgent } from "./knowledge-agent";

const instructionsOf = async () =>
  String(
    await (
      createKnowledgeAgent() as unknown as {
        getInstructions: (a?: unknown) => Promise<string>;
      }
    ).getInstructions({}),
  );

describe("createKnowledgeAgent", () => {
  it("未確認情報を補完せず、質問の中心に必要な事実を返す", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain("検索結果にない情報を補完しない");
    expect(ins).toContain("質問の中心に必要な事実");
    expect(ins).toContain("回答に影響する重要な項目");
    expect(ins).not.toContain("質問された項目を漏れなく確認");
  });

  it("ユーザー向けの文章ではなく調査メモを返す", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain("ユーザー向けの文章に整えない");
    expect(ins).toContain("確認できた事実");
    expect(ins).toContain("関連URL");
    expect(ins).toContain("不確実・矛盾・未確認");
  });

  it("検索結果が矛盾するときの優先基準を含む", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain("より新しく公式性の高い情報を優先");
    expect(ins).toContain("差異を明記する");
  });

  it("時間依存の村内情報はナレッジと配信の両方を検索する", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain(
      "最近・現在・今後の村内イベント、休業、変更、募集、告知",
    );
    expect(ins).toContain("knowledgeSearchTool と broadcastGetTool の両方");
  });

  it("配信を参照する質問は配信検索を優先する", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain("配信を指す質問では broadcastGetTool を優先");
  });

  it("検索とリトライの同じ指示を繰り返さない", async () => {
    const ins = await instructionsOf();
    expect(ins.match(/書き換えて再検索する/g)).toHaveLength(1);
    expect(ins.match(/検索結果にない情報を補完しない/g)).toHaveLength(1);
  });

  it("未確定情報を省かず、確度を保って伝える", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain("情報は確度を保って伝える");
    expect(ins).toContain("未確定の情報を確定した事実として扱わず");
    expect(ins).toContain("有用な未確定情報まで省かない");
    expect(ins).not.toContain("確定・予定・見込み・例年の傾向");
  });

  it("現在性が回答に影響するときだけ情報の時点を考慮する", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain("情報の現在性が回答に影響する場合");
    expect(ins).toContain("最新状況を確認できない場合");
    expect(ins).toContain("必要に応じて直接確認を案内する");
    expect(ins).not.toContain("古い情報を使う場合は");
  });

  it("現在日時を検索語へ機械的に追加しない", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain("現在の日付や年を機械的に追加しない");
    expect(ins).toContain("「今日」は上記の現在日時との照合に使う");
    expect(ins).toContain("過去の日付を「今日」として扱わない");
    expect(ins).not.toContain(
      "時間表現がない場合でも、時間依存の情報は現在の年度・年を基準にクエリを生成する",
    );
  });
});
