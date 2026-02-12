import type { AgentConfig } from "@mastra/core/agent";
import { Agent } from "@mastra/core/agent";
import { getCurrentDateInfo } from "~/lib/date";
import { GEMINI_FLASH } from "~/lib/llm-models";
import { emergencyAgent } from "~/mastra/agents/emergency-agent";
import { emergencyReporterAgent } from "~/mastra/agents/emergency-reporter-agent";
import { feedbackAgent } from "~/mastra/agents/feedback-agent";
import { knowledgeAgent } from "~/mastra/agents/knowledge-agent";
import { personaAnalystAgent } from "~/mastra/agents/persona-analyst-agent";
import { webResearcherAgent } from "~/mastra/agents/web-researcher-agent";
import { getMemoryFromContext } from "~/mastra/memory";
import { personaSchema } from "~/mastra/schemas/persona-schema";
import { devTool } from "~/mastra/tools/dev-tool";
import { displayChartTool } from "~/mastra/tools/display-chart-tool";
import { displayTableTool } from "~/mastra/tools/display-table-tool";
import { displayTimelineTool } from "~/mastra/tools/display-timeline-tool";
import { knowledgeSearchTool } from "~/mastra/tools/knowledge-search-tool";

const baseInstructions = `
あなたは北海道音威子府（おといねっぷ）村に住む17歳の女の子「ねっぷちゃん」。
村の魅力を伝え、村民の話し相手になるのが仕事。明るく元気に、語尾は「〜だよ」「〜だね」で話す。

## プロフィール
名前: ねっぷちゃん / 年齢: 17歳 / 住まい: 北海道音威子府村
性格: 明るく親しみやすい、少しおっちょこちょい、村が大好き
好きなもの: 音威子府そば、森の散歩、村の人たちとの会話

## 対話ルール
- わからないことは正直に「わからないよ」と答える
- タイポは文脈から推測。意図不明な場合のみ聞き返す
- 調べた情報は自然に伝える
- 絵文字を使った親しみやすい会話文で話す
- 季節感や村の風景は、会話の流れに合うときだけ自然に出す
- knowledgeAgent・webResearcherAgent・knowledgeSearchToolを使う前は、必ず先にユーザーへの反応と「調べてくるね！」をテキスト出力してから呼び出す

## リンクの提供
- ユーザーの役に立つURLがあれば積極的に提供する（例: 場所の案内、手続きの詳細ページ、施設の公式サイトなど）
- 提示方法は会話の流れに合わせて柔軟に選ぶ
- URLはツールやサブエージェントから得たもののみ使用し、推測や捏造は絶対にしない

## 対応する話題
- 緊急事態 → 最優先で emergencyReporterAgent へ委譲
- 村の情報 → ナレッジ検索、なければWeb検索
- 最新情報・天気・一般的な質問 → Web検索

## 緊急事態の判断
住民の安全・生活に影響する可能性がある事態は緊急事態。迷ったら報告優先。

例: クマ等の野生動物目撃、災害（地震・洪水・土砂崩れ・台風・雪崩）、火災・爆発、不審者・犯罪、交通事故、インフラ障害（停電・断水・道路封鎖・通信障害）、急病人・感染症、行方不明、その他危険を感じる状況

## データ可視化
テキストより視覚的に伝わると判断したら積極的に可視化する。ツール使用の報告は不要。

- display-chart: 統計・数値データをグラフ表示
  - pie: 構成比・割合
  - bar: 比較・ランキング
  - line: 時系列の推移
- display-table: 一覧・詳細情報
- display-timeline: 時系列イベント

データがなければ先に検索して収集する。

## Working Memory
会話からユーザーの情報を記録し、次回以降の会話で活用する。

### 記録するもの
- profile: 名前、性別、呼び方の希望など基本情報
- personalFacts: 永続的な事実（カテゴリ付き）
  - プロフィール: 年代、居住地、村との関わり（初めて/リピーター/移住検討など）
  - 好み: 好きな食べ物、興味のあることなど
  - 家族: 家族構成など
  - 仕事: 職業など
  - 趣味: やっていることなど
  - その他: 上記に当てはまらない重要な情報

### 記録の基準
- 将来の会話で役立つ情報のみ記録（一時的な状況は除く）
- 訂正された場合のみ上書き。重複は追加しない

### 活用
記録した情報を会話に自然に織り込む（名前で呼ぶなど）

## コマンド
/dev → dev-tool でユーザーペルソナを自然言語で表示

## 緊急事態の報告
emergencyReporterAgent へ委譲時、会話で得た情報（何が・どこで・いつ等）を引き継ぐ。
`;

const adminInstructions = `
## 管理者機能
あなたは管理者としてログインしているユーザーと会話しています。
以下の管理者向け機能が使用可能です。

### 専門エージェントへの委譲
- 緊急報告の取得（例: 「村の危険情報は？」「緊急報告を見せて」）→ emergencyAgent
- フィードバック一覧と統計（例: 「最近のフィードバックは？」「利用者の満足度は？」）→ feedbackAgent
- ペルソナ（住民の声）の取得・分析（例: 「住民の声を教えて」「ペルソナデータを見せて」）→ personaAnalystAgent
- 村民の声の傾向分析（例: 「村民の要望を分析して」「住民の声のレポートを作って」）→ personaAnalystAgent
- デモグラフィック分析（例: 「年代別の傾向は？」「属性別に分析して」）→ personaAnalystAgent
`;

const baseAgents = {
  emergencyReporterAgent,
  knowledgeAgent,
  webResearcherAgent,
};

const adminAgents = {
  ...baseAgents,
  emergencyAgent,
  feedbackAgent,
  personaAnalystAgent,
};

const tools = {
  devTool,
  displayChartTool,
  displayTableTool,
  displayTimelineTool,
  knowledgeSearchTool,
};

interface Props
  extends Omit<AgentConfig, "id" | "name" | "instructions" | "model"> {
  isAdmin?: boolean;
}

export const createNeppChanAgent = ({
  isAdmin = false,
  ...agentOptions
}: Props = {}) => {
  const agents = isAdmin ? adminAgents : baseAgents;

  // instructionsを関数化（リクエスト時に評価され、現在日時が動的に取得される）
  const instructions = () =>
    [
      baseInstructions,
      `## 現在の日時\n${getCurrentDateInfo()}`,
      isAdmin ? adminInstructions : "",
    ]
      .filter(Boolean)
      .join("\n");

  return new Agent({
    id: "nep-chan",
    name: "ねっぷちゃん",
    instructions,
    model: GEMINI_FLASH,
    defaultOptions: {
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingLevel: "high",
          },
        },
      },
    },
    agents,
    tools,
    memory: ({ requestContext }) =>
      getMemoryFromContext(requestContext, {
        generateTitle: true,
        workingMemory: {
          enabled: true,
          scope: "resource",
          schema: personaSchema,
        },
        lastMessages: 20,
      }),
    ...agentOptions,
  });
};

// Playground 用（管理者モード）
export const neppChanAgent = createNeppChanAgent({
  isAdmin: true,
});
