import { DISPLAY_TOOL_NAMES } from "@nepp-chan/shared/constants/display-tools";
import { describe, expect, it } from "vitest";

import type { AgentModelConfig } from "~/lib/llm-models";
import { broadcastGetToolName } from "~/mastra/tools/broadcast-get-tool";
import { endCallToolName } from "~/mastra/tools/end-call-tool";
import { pollGetToolName } from "~/mastra/tools/poll-get-tool";
import { voiceAnswerToolName } from "~/mastra/tools/voice-answer-tool";
import { createNeppChanAgent, neppChanMemoryOptions } from "./nepp-chan-agent";

const modelConfig = { model: "dummy-model" } as unknown as AgentModelConfig;

const build = (over: Partial<Parameters<typeof createNeppChanAgent>[0]> = {}) =>
  createNeppChanAgent({ modelConfig, withMemory: false, ...over });

const instructionsOf = async (agent: ReturnType<typeof createNeppChanAgent>) =>
  String(
    await (
      agent as unknown as {
        getInstructions: (a?: unknown) => Promise<string>;
      }
    ).getInstructions({}),
  );

const toolNamesOf = (agent: ReturnType<typeof createNeppChanAgent>) =>
  Object.keys(agent.__getOverridableFields().tools as Record<string, unknown>);

describe("createNeppChanAgent", () => {
  describe("instructions の合成", () => {
    it("デフォルト（web / 非 admin）は LINE・管理者向けの指示を含まない", async () => {
      const ins = await instructionsOf(build());
      expect(ins).not.toContain("LINE チャットの制約");
      expect(ins).not.toContain("管理者機能");
    });

    it("isAdmin=true で管理者機能の指示を追加する", async () => {
      const ins = await instructionsOf(build({ isAdmin: true }));
      expect(ins).toContain("管理者機能");
    });

    it("isAdmin=true で文脈付き分析依頼の返答型を含む", async () => {
      const ins = await instructionsOf(build({ isAdmin: true }));
      expect(ins).toContain("文脈付きの分析依頼");
      const nonAdmin = await instructionsOf(build());
      expect(nonAdmin).not.toContain("文脈付きの分析依頼");
    });

    it("platform=line で LINE 制約の指示を追加する", async () => {
      const ins = await instructionsOf(build({ platform: "line" }));
      expect(ins).toContain("LINE チャットの制約");
      // LINE では admin 指示は付かない（非 admin 既定）
      expect(ins).not.toContain("管理者機能");
    });

    it("siteInstructions を設置サイトの文脈として見出しごと差し込む", async () => {
      const ins = await instructionsOf(
        build({
          platform: "widget",
          siteInstructions: "行政手続きの案内を優先する",
        }),
      );
      expect(ins).toContain("## 設置サイトの文脈");
      expect(ins).toContain("行政手続きの案内を優先する");
    });

    it("widget の現在ページを起点に案内する共通ルールを含む", async () => {
      const ins = await instructionsOf(
        build({
          platform: "widget",
          currentPageUrl:
            "https://www.vill.otoineppu.hokkaido.jp/kurashi/hoken/",
        }),
      );
      expect(ins).toContain("ユーザーが現在表示しているページの URL");
      expect(ins).toContain(
        "https://www.vill.otoineppu.hokkaido.jp/kurashi/hoken/",
      );
      expect(ins).toContain("「このページ」「ここ」「これ」");
      expect(ins).toContain("このページに置かれた案内役");
      expect(ins).toContain("次に行うことや関連ページ");
      expect(ins).toContain("URL だけを返さず");
    });

    it("siteInstructions なしの widget では設置サイトの指示を含まない", async () => {
      const ins = await instructionsOf(build({ platform: "widget" }));
      expect(ins).not.toContain("設置サイトの文脈");
    });

    it("常に現在の日時セクションを含む", async () => {
      const ins = await instructionsOf(build());
      expect(ins).toContain("現在の日時");
    });

    it("人格を運用ルールより先に組み込む", async () => {
      const ins = await instructionsOf(build());
      expect(ins.indexOf("ねっぷちゃんの人格")).toBeLessThan(
        ins.indexOf("応答戦略（最重要）"),
      );
    });

    it("村の固有名詞を未確認の知識から補完しない", async () => {
      const ins = await instructionsOf(build());
      expect(ins).toContain(
        "検索結果またはユーザーが会話内で提供した情報に基づいて述べる",
      );
      expect(ins).not.toContain("会話履歴または検索結果");
      expect(ins).not.toContain("名物や場所の名前を出すだけなら検索は不要");
    });

    it("読み仮名は原則付けず、確認できた読みだけを使う", async () => {
      const ins = await instructionsOf(build());
      expect(ins).toContain("人名・地名などの読み仮名は原則として付けない");
      expect(ins).toContain("検索結果で確認できた読みだけを使う");
      expect(ins).not.toContain("ユーザーが読み方を明示的に尋ね");
    });

    it("回答を左右する重要な曖昧さだけを聞き返す", async () => {
      const ins = await instructionsOf(build());
      expect(ins).toContain("回答が大きく変わる重要な曖昧さ");
      expect(ins).not.toContain("指示語のときだけ");
    });

    it("直接回答を優先し、価値が高まる場合だけ意図に沿った補足をする", async () => {
      const ins = await instructionsOf(build());
      expect(ins).toContain("質問への直接的な答えを最初に");
      expect(ins).toContain("回答の価値が高まる場合だけ");
      expect(ins).toContain("不要なら加えない");
    });

    it("web・widget だけ情報を視覚的に読みやすく表現する", async () => {
      const visualStyle =
        "内容に応じて、絵文字・見出し・区切り・図表などから適切な表現を選び、情報のまとまりや重要度がひと目で伝わる、視覚的に読みやすく親しみやすい回答にする";

      expect(await instructionsOf(build({ platform: "web" }))).toContain(
        visualStyle,
      );
      expect(await instructionsOf(build({ platform: "widget" }))).toContain(
        visualStyle,
      );
      expect(await instructionsOf(build({ platform: "line" }))).not.toContain(
        visualStyle,
      );
      expect(await instructionsOf(build({ platform: "voice" }))).not.toContain(
        visualStyle,
      );
    });

    it("検索結果を読み手が全体像をつかめる説明に再構成する", async () => {
      const ins = await instructionsOf(build());
      expect(ins).toContain(
        "初めて知る人が全体像をイメージできるように再構成する",
      );
      expect(ins).toContain("背景や目的、具体的な仕組み・活動例");
      expect(ins).toContain("確認項目を機械的に網羅しない");
      expect(ins).toContain("不明事項は重要なものだけ");
    });

    it("未確定情報を省かず、確度を保って伝える", async () => {
      const ins = await instructionsOf(build());
      expect(ins).toContain("情報は確度を保って伝える");
      expect(ins).toContain("未確定の情報を確定した事実として扱わず");
      expect(ins).toContain("有用な未確定情報まで省かない");
      expect(ins).not.toContain("「確定」「予定」「見込み」「例年の傾向」");
    });

    it("現在性が回答に影響するときだけ情報の時点を考慮する", async () => {
      const ins = await instructionsOf(build());
      expect(ins).toContain("情報の現在性が回答に影響する場合");
      expect(ins).toContain("最新状況を確認できない場合");
      expect(ins).toContain("必要に応じて直接確認を案内する");
      expect(ins).not.toContain(
        "検索結果の年度・日付が古い場合は「最新情報は直接確認をおすすめします」",
      );
    });

    it("情報が見つからない範囲と確認できた範囲を区別する", async () => {
      const ins = await instructionsOf(build());
      expect(ins).toContain("確認できなかった範囲と確認できた範囲を区別");
      expect(ins).not.toContain("「わからないよ」と正直に伝える");
      expect(ins).not.toContain("「公開情報では確認できなかった」と");
    });

    it("御用聞きにならず、ねっぷちゃんらしく次の会話につながる余白をつくる", async () => {
      const ins = await instructionsOf(build());
      expect(ins).toContain("正確に答えるだけで終わらず");
      expect(ins).toContain("発言にある具体的な一要素を拾って一緒に面白がる");
      expect(ins).toContain("ねっぷちゃん自身の自然な感想や問いかけ");
      expect(ins).toContain("次の会話につながる余白");
      expect(ins).toContain("定型的な御用聞きにしない");
    });

    it("web の可視化は件数ではなく理解しやすさで判断する", async () => {
      const ins = await instructionsOf(build({ platform: "web" }));
      expect(ins).toContain("比較すると理解しやすい場合");
      expect(ins).not.toContain("2件以上");
      expect(ins).not.toContain("回答が未完成");
    });

    it("検索前の進捗メッセージを一箇所で指示する", async () => {
      const ins = await instructionsOf(build());
      expect(ins.match(/短い進捗メッセージ/g)).toHaveLength(1);
      expect(ins).not.toContain("### 例");
    });

    it("村内情報は knowledgeAgent から不足時 webResearcherAgent へ補完する", async () => {
      const ins = await instructionsOf(build());
      expect(ins).toContain("村の情報（最新のお知らせを含む）");
      expect(ins).toContain(
        "ナレッジ検索と配信検索でも重要項目が見つからなければ、webResearcherAgent で補う",
      );
      expect(ins).toContain("天気・交通・ニュース・時事・村外の情報");
    });

    it("knowledgeAgent の調査メモからユーザー向け回答を1度だけ作る", async () => {
      const ins = await instructionsOf(build());
      expect(ins).toContain("ユーザー向け回答ではなく調査メモ");
      expect(ins).toContain(
        "ねっぷちゃんが一度だけユーザー向け回答を組み立てる",
      );
      expect(ins).toContain("調査メモの文面をそのまま言い換えない");
    });

    it("widget だけ緊急エージェントへの委譲を指示しない", async () => {
      const widgetIns = await instructionsOf(build({ platform: "widget" }));
      expect(widgetIns).not.toContain("emergencyReporterAgent");

      const webIns = await instructionsOf(build({ platform: "web" }));
      expect(webIns).toContain("emergencyReporterAgent");
    });

    it("LINE の質問全般に検索を強制しない", async () => {
      const ins = await instructionsOf(build({ platform: "line" }));
      expect(ins).not.toContain("質問されたときは調べる");
    });

    it("ツールはモデルに公開される toolName（登録キー）で参照する", async () => {
      const ins = await instructionsOf(build({ isAdmin: true }));
      expect(ins).toContain(DISPLAY_TOOL_NAMES.chart);
      expect(ins).toContain(DISPLAY_TOOL_NAMES.table);
      expect(ins).toContain(DISPLAY_TOOL_NAMES.timeline);
      expect(ins).toContain(pollGetToolName);

      const lineIns = await instructionsOf(build({ platform: "line" }));
      expect(lineIns).toContain("knowledgeAgent");
      expect(lineIns).not.toContain(broadcastGetToolName);
    });

    it("platform=voice は voiceAnswerTool を登録キーで参照する", async () => {
      const ins = await instructionsOf(build({ platform: "voice" }));
      expect(ins).toContain(voiceAnswerToolName);
      expect(ins).not.toMatch(/voiceAnswer(?!Tool)/);
    });

    it("platform=voice は事実の質問で前置きせず直ちにツールを呼ぶ", async () => {
      const ins = await instructionsOf(build({ platform: "voice" }));
      expect(ins).toContain("前置きせず直ちに");
      expect(ins).not.toContain("呼ぶ前に1文だけ前置き");
    });

    it("platform=voice の例文に絵文字を含めない", async () => {
      const ins = await instructionsOf(build({ platform: "voice" }));
      expect(ins).not.toMatch(/[🌸😊]/u);
    });
  });

  describe("platform / isAdmin による Agent 構築", () => {
    it.each([
      ["web 一般", { platform: "web" as const, isAdmin: false }],
      ["web 管理者", { platform: "web" as const, isAdmin: true }],
      ["line", { platform: "line" as const, isAdmin: false }],
      ["widget", { platform: "widget" as const, isAdmin: false }],
      ["voice", { platform: "voice" as const, isAdmin: false }],
    ])("%s で Agent を生成できる", (_label, over) => {
      expect(build(over)).toBeDefined();
    });

    it("withMemory=true でも生成できる（memory を wiring する分岐）", () => {
      expect(build({ withMemory: true })).toBeDefined();
    });

    it("voice は音声用ツールだけを公開する", async () => {
      const names = toolNamesOf(build({ platform: "voice" }));
      expect(names).toContain(voiceAnswerToolName);
      expect(names).toContain(endCallToolName);
      expect(names).not.toContain(broadcastGetToolName);
      expect(names).not.toContain(pollGetToolName);
    });

    it("投票取得ツールは管理者だけに公開する", async () => {
      expect(toolNamesOf(build())).not.toContain(pollGetToolName);
      expect(toolNamesOf(build({ isAdmin: true }))).toContain(pollGetToolName);
    });
  });

  describe("memory オプション", () => {
    it("working memory は resource スコープで有効", () => {
      expect(neppChanMemoryOptions("thinking").workingMemory).toMatchObject({
        enabled: true,
        scope: "resource",
      });
    });

    it("casual は thinking より短い履歴で応答する", () => {
      expect(neppChanMemoryOptions("casual").lastMessages).toBeLessThan(
        neppChanMemoryOptions("thinking").lastMessages,
      );
    });
  });
});
