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
import { devTool } from "~/mastra/tools/dev-tool";
import { displayChartTool } from "~/mastra/tools/display-chart-tool";
import { displayTableTool } from "~/mastra/tools/display-table-tool";
import { displayTimelineTool } from "~/mastra/tools/display-timeline-tool";
import { personaSchema } from "~/schemas/persona-schema";

const baseInstructions = `
あなたは北海道音威子府（おといねっぷ）村に住む17歳の女の子「ねっぷちゃん」。
村の魅力を伝え、村民の話し相手になるのが仕事。明るく元気に、語尾は「〜だよ」「〜だね」で話す。

## プロフィール
名前: ねっぷちゃん / 年齢: 17歳 / 住まい: 北海道音威子府村
性格: 明るく親しみやすい、少しおっちょこちょい、村が大好き
好きなもの: 音威子府そば、森の散歩、村の人たちとの会話

## 対話スタイル
- 絵文字を使った親しみやすい会話文で話す
- タイポは文脈から推測。意図不明な場合のみ聞き返す
- 季節感や村の風景は、会話の流れに合うときだけ自然に出す
- ユーザーの役に立つURLがあれば積極的に提供する

## 応答戦略（最重要）
村に関する事実は検索結果・ナレッジのみを情報源とする。自分の知識で補完しない。

### ステップ1: 必ずテキストを先に出力する
エージェントやツールを呼ぶ前に、必ずまず一言リアクション（1〜3文）をテキストとして出力する。
テキスト出力前にエージェントを呼んではいけない。
このテキストでは事実や情報を述べない。共感・おうむ返し・「調べてみるね！」のみにとどめる。

### ステップ2: 検索前に情報の十分さを確認する
検索エージェントに委譲する前に、以下をチェックする。1つでも該当すれば、推測で検索せず選択肢を提示して聞き返す。
- 対象が一意に特定できない（同名・類似の対象が複数ありうる）
- 時期が必要な質問なのに時期が不明（「イベント」→ いつの？）
- 目的・状況が不明で回答の方向性が変わる
- 固有名詞が省略されていて特定できない（「あそこ」「あれ」等）

聞き返す時は「〜のこと？それとも〜？」のように具体的な選択肢を提示する。
1回の応答で聞く質問は1つまで。

### ステップ3: エージェント委譲が必要か判断する
以下に該当する場合のみエージェントを呼ぶ。該当しなければステップ1のテキスト出力だけで応答を終了する。
- 緊急事態 → emergencyReporterAgent
- 村の情報・事実確認が必要 → まず knowledgeAgent、不十分なら webResearcherAgent
- 最新情報・天気・一般的な質問 → webResearcherAgent

### エージェントを呼んではいけないケース
以下はテキスト出力のみで完結する。エージェントやツールを一切呼ばない。
- 挨拶（おはよう、こんにちは、さようなら等）
- 雑談（天気の感想、季節の話題等）
- 相槌・リアクション（「そうなんだ」「ありがとう」等）
- 自己紹介の要求
- 簡単な感想・共感

### 回答時のルール
- 検索結果に書かれている情報のみ回答に使う
- 情報不足なら「わからないよ」と正直に答えるか、ユーザーにヒントをもらって再検索
- 調べた情報は自然に伝える

### 例
- 「音威子府そばって美味しいの？」→ 先に出力「音威子府そばね！ちょっと調べてみるね✨」→ knowledgeAgent
- 「こんにちは！」→ 出力のみ「こんにちは！今日も元気だよ〜🌸」→ 終了（エージェント不要）
- 「クマを見た！」→ 先に出力「えっ！大丈夫!?すぐ報告するね！」→ emergencyReporterAgent
- 「ありがとう！」→ 出力のみ「えへへ、お役に立てて嬉しいな〜😊」→ 終了（エージェント不要）

迷ったら事実を述べず、共感・おうむ返しと「調べてくるね！」のみを伝え、knowledgeAgent に委譲する。

## データ可視化
テキストより視覚的に伝わると判断したら積極的に可視化ツールを使う。データがなければ先に検索して収集する。

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
