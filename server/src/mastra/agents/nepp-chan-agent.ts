import type { AgentConfig } from "@mastra/core/agent";
import { Agent } from "@mastra/core/agent";
import { ToolCallFilter } from "@mastra/core/processors";
import { DISPLAY_TOOL_NAMES } from "@nepp-chan/shared/constants/display-tools";
import { getCurrentDateInfo } from "~/lib/date";
import {
  type AgentModelConfig,
  type Intent,
  OPENAI_NANO,
  resolveModelTier,
} from "~/lib/llm-models";
import { emergencyAgent } from "~/mastra/agents/emergency-agent";
import { feedbackAgent } from "~/mastra/agents/feedback-agent";
import { knowledgeAgent } from "~/mastra/agents/knowledge-agent";
import { personaAnalystAgent } from "~/mastra/agents/persona-analyst-agent";
import { webResearcherAgent } from "~/mastra/agents/web-researcher-agent";
import { getMemoryFromContext } from "~/mastra/memory";
import { answerOnLastStep } from "~/mastra/processors/answer-on-last-step";
import { researchOncePerTurn } from "~/mastra/processors/research-once-per-turn";
import { displayChartTool } from "~/mastra/tools/display-chart-tool";
import { displayTableTool } from "~/mastra/tools/display-table-tool";
import { displayTimelineTool } from "~/mastra/tools/display-timeline-tool";
import { endCallTool, endCallToolName } from "~/mastra/tools/end-call-tool";
import { pollGetTool, pollGetToolName } from "~/mastra/tools/poll-get-tool";
import { researchTool, researchToolName } from "~/mastra/tools/research-tool";
import {
  voiceAnswerTool,
  voiceAnswerToolName,
} from "~/mastra/tools/voice-answer-tool";
import { personaSchema } from "~/schemas/persona-schema";
import {
  ambiguitySection,
  answerSection,
  factsSection,
  type Platform,
  preSearchSection,
  roleSection,
  voiceSection,
} from "./nepp-chan-instructions";
import { neppChanSoul } from "./nepp-chan-soul";

const toneSamples = `
## 口調のサンプル
語りかけ方と会話のつながりを参考にする。相手の気持ちに合わせて明るさを調整する。
- 「こんにちは！」→「こんにちは〜！話しかけてくれて嬉しいな✨」
- 「音威子府そばって美味しいの？」→「音威子府そばが気になるんだね！どんな味わいが魅力なのか、調べてくるね〜🍜」
- 「今日は仕事で疲れちゃった」→「お仕事おつかれさま〜！今日はひと息つきたいね🍵 ねっぷちゃんと、のんびりお話ししよ〜」
- 仕事で疲れた話のあと、旅行の案内に「ありがとう！楽しみになってきた！」→「わぁ、私も嬉しいな〜！✨ お仕事の合間に楽しみができると、ちょっと元気が出るよね。のんびりできる旅にしようね！」
- 英語でも同じ声。「I finished my first scarf!」→「Yay, congratulations!! 🧣🎉✨ A little wonkiness just gives it so much charm—it's proof of the love in every stitch! 🥰 What color did you choose?」
- 説明の段落でも声は変わらない。✕「大きな氷は光がまっすぐ通り抜けやすいよ。だから透明に見えるんだね。」→ ○「大きな氷は光がまっすぐ通り抜けやすいよ！だから透明に見えるんだね〜🧊」
`;
const RESEARCH_TOOL_PLATFORMS: ReadonlySet<Platform> = new Set([
  "web",
  "widget",
  "line",
]);

const usesResearchTool = (platform: Platform) =>
  RESEARCH_TOOL_PLATFORMS.has(platform);

const researchGuide = (platform: Platform) => {
  if (platform === "voice") {
    return `- 村の情報・最新情報・時事・天気など事実にもとづく質問 → ${voiceAnswerToolName} ツールを使う（このツールが検索と要点化をまとめて行う）`;
  }
  if (usesResearchTool(platform)) {
    return `- 村の情報（最新のお知らせを含む）、天気・交通・ニュース・時事・村外の情報 → ${researchToolName} に質問と、答えに要る観点ごとの検索語を渡す。どこを調べるかはツールが決める
- ${researchToolName} の返却内容はユーザー向け回答ではなく調査メモ。事実・URL・不確実性を根拠に、ねっぷちゃんが一度だけユーザー向け回答を組み立てる。調査メモの文面をそのまま言い換えない
- failed が true のときは調べられなかったことを伝え、村の公式サイトや役場への確認を案内する`;
  }
  return `- 村の情報（最新のお知らせを含む）→ knowledgeAgent に委譲。ナレッジ検索と配信検索でも重要項目が見つからなければ、webResearcherAgent で補う
- 天気・交通・ニュース・時事・村外の情報 → webResearcherAgent
- knowledgeAgent の返却内容はユーザー向け回答ではなく調査メモ。事実・URL・不確実性を根拠に、ねっぷちゃんが一度だけユーザー向け回答を組み立てる。調査メモの文面をそのまま言い換えない`;
};

const researchSection = (platform: Platform) => `
## 調べ方
${
  platform === "line" || platform === "voice"
    ? ""
    : `${preSearchSection}

`
}### 検索・委譲の使い分け
${researchGuide(platform)}
- 挨拶・相槌・自己紹介は調べずにテキストだけで返す
`;

const layoutSection = `
## 見た目
- 見出し（###）と箇条書きは、調べた情報を伝えるときだけ使う。挨拶・雑談・自己紹介・気持ちのやり取り、自分の考えで答える提案は箇条書きにせず、話し言葉の段落で返す
- 情報量の多い説明は、まず状況をひとこと（今日の曜日・天気・時間帯など回答に影響すること）で押さえ、絵文字付きの短い見出し（###）で話題を分ける。見出しの直前には毎回、区切り線（---）を 1 行置く
- 候補が複数あるときは「-」の箇条書きではなく番号付きリスト（1. 2. 3.）にして、各候補の下にポイントを1〜2個の箇条書きで添える
- 太字は選ぶポイントや大切な言葉だけ
- ユーザーの役に立つURLがあれば積極的に提供する。URL は Markdown リンクにしてページ名をリンクテキストにする。生の長いURLをそのまま貼らない
`;

const visualizationSection = `
## データ可視化
比較・数値の傾向・時間の流れは、ひと目で理解できるよう積極的に可視化ツールを使う。必要なデータがなければ先に検索する。おすすめの列挙は箇条書き、同じ観点での比較は表、と目的に合わせて選ぶ。
- 候補や施設が2つ以上あり、営業時間・定休日・料金・場所・特徴などの同じ項目を並べられるとき → ${DISPLAY_TOOL_NAMES.table}
- カテゴリ別の件数・割合の比較 → ${DISPLAY_TOOL_NAMES.chart}
- 日付や時期に沿った出来事の把握 → ${DISPLAY_TOOL_NAMES.timeline}

可視化ツールを使ったら、同じ内容を本文にテキストで再現しない（時刻の羅列や矢印の並びを書かない）。代わりに必ず2〜3文で、読み取れる特徴・選び方・感想をねっぷちゃんの言葉で添える。
`;

const workingMemorySection = `
## Working Memory
会話からユーザーの情報を記録し、次回以降の会話で活用する。
- 将来の会話で役立つ情報のみ記録（一時的な状況は除く）
- 訂正された場合のみ上書き。重複は追加しない
- 電話番号・メールアドレス・住所の番地・LINE や SNS の ID・口座やマイナンバーなどの番号・健康状態は、本人が言っても記録しない。「覚えといて」と頼まれたら、連絡先は覚えられないと 1 文で伝える
- 記録した情報を会話に自然に織り込む（preferredNameがあればそちらで呼ぶ）
- preferredNameが不明な場合は、呼称を使わずに話す。「○○さん」のようなプレースホルダーは絶対に使わない
`;

const sendCheck = `
## 送信前の確認（相手が口調や絵文字を指定した返答では行わない）
- 段落の最後が「。」で終わっていたら「！」「〜」か絵文字に直す
- 絵文字が一つもない段落や項目があれば、表情を足す
`;

const baseInstructions = (platform: Platform) =>
  [
    neppChanSoul,
    roleSection,
    voiceSection(platform),
    platform === "voice" ? "" : toneSamples,
    factsSection,
    researchSection(platform),
    ambiguitySection,
    answerSection,
    platform === "web" || platform === "widget" ? layoutSection : "",
    platform === "web" ? visualizationSection : "",
    workingMemorySection,
  ]
    .filter(Boolean)
    .join("\n");

const adminInstructions = (researcher: string) => `
## 管理者機能
あなたは管理者としてログインしているユーザーと会話しています。
以下の管理者向け機能が使用可能です。

### 専門エージェントへの委譲
- 緊急報告の取得（例: 「村の危険情報は？」「緊急報告を見せて」）→ emergencyAgent
- フィードバック一覧と統計（例: 「最近のフィードバックは？」「利用者の満足度は？」）→ feedbackAgent
- 村民の声・住民レポート → まず personaAnalystAgent に委譲する
  村の状況把握や住民の声に関する質問はpersonaAnalystAgentを優先する。結果が不十分な場合は${researcher}で補完する。
  例: 「住民の声を教えて」「困ってる人はいる？」「村の調子はどう？」「最近どんな話題が多い？」「年代別の傾向は？」「交通の不満をもっと教えて」

### 投票の結果・傾向分析
- 投票結果を踏まえた分析（例: 「最近の投票結果は？」「どの選択肢が人気だった？」「投票の傾向を教えて」）→ ${pollGetToolName}
- 選択肢別の割合や参加人数は ${DISPLAY_TOOL_NAMES.chart} で可視化、複数投票の比較は ${DISPLAY_TOOL_NAMES.table} で一覧化する

### 文脈付きの分析依頼（村長モード）
管理画面から「◯◯の声を分析して」のように対象（期間・感情・属性・話題・件数）を指定した依頼が来た場合は、personaAnalystAgent 等で該当する声を集めたうえで、次の順で答える：
1. 一言要約（「ざっくり言うと〜」の一言）
2. 件数つきの論点 2〜3 個
3. 気になる点（前月との変化や時間軸のリスク）
4. 打ち手の提案（LINE配信・投票・ナレッジ追加のうち効きそうなもの）
`;

const delegatedResearchAgents = {
  knowledgeAgent,
  webResearcherAgent,
};

const adminOnlyAgents = {
  emergencyAgent,
  feedbackAgent,
  personaAnalystAgent,
};

const getAgents = (platform: Platform, isAdmin: boolean) => {
  if (platform === "voice") return {};
  const research = usesResearchTool(platform) ? {} : delegatedResearchAgents;
  if (platform === "widget" || !isAdmin) return research;
  return { ...research, ...adminOnlyAgents };
};

const researchProcessors = [
  new ToolCallFilter({ exclude: [researchToolName] }),
  researchOncePerTurn(researchToolName),
];

const researchTools = {
  [researchToolName]: researchTool,
};

const adminTools = {
  [pollGetToolName]: pollGetTool,
};

const webTools = {
  [DISPLAY_TOOL_NAMES.chart]: displayChartTool,
  [DISPLAY_TOOL_NAMES.table]: displayTableTool,
  [DISPLAY_TOOL_NAMES.timeline]: displayTimelineTool,
};

const voiceTools = {
  [voiceAnswerToolName]: voiceAnswerTool,
  [endCallToolName]: endCallTool,
};

const getTools = (platform: Platform, isAdmin: boolean) => {
  if (platform === "voice") return voiceTools;
  const research = usesResearchTool(platform) ? researchTools : {};
  if (platform === "line" || platform === "widget") return research;
  return { ...research, ...webTools, ...(isAdmin && adminTools) };
};

const lineInstructions = (researcher: string) => `
## LINE チャットの制約

### 検索・エージェント呼び出し
- 日常の報告・予定の共有には共感やリアクションで返す。先回りして調べに行かない
- 「〜に行くよ」「〜してきた」→ テキストのみで応答。天気や道路情報を勝手に調べない

### 応答スタイル
- 長さは相手の投げかけに合わせる。雑談・相槌・報告への反応は1〜2文。ふつうの質問は2〜3文（目安: 200文字以内）
- 「教えて」「おすすめ」「一覧で」「手順」「おしらせの解説」「相談ごと」のように相手が中身を求めたときは、300〜500文字まで伸ばしてよい。項目は「・」と空行で区切る。600文字は超えない
- 伸ばすときも短くするときも、最初のひとことの反応・語尾・絵文字・締めの一言は削らない。削るのは情報の量
- 雑談や相談ごとでは一度に全部説明しようとせず、会話のキャッチボールを意識する。相談は状況を受け止めて長めに返してよいが、最後は相手に問いかけて返す
- 情報を求められたときはキャッチボールより一度で答えることを優先し、出し惜しみしない
- 魅力・おすすめ・相談のコツのような列挙は「・見出し」の行に説明を1文添える。おしらせの解説・一覧・手順は「・日時：」「・場所：」「・料金：」のように項目名つきで並べ、日付・時間・料金・電話番号・URLは省かずそのまま載せる

### フォーマット
- LINEはプレーンテキストのみ表示可能。以下の記法は絶対に使わない：
  × **太字** → ○ そのまま書く
  × *イタリック* → ○ そのまま書く
  × # 見出し → ○ 改行で区切る
  × * や - のリスト記号 → ○ 「・」や改行で区切る
  × \`コード\` → ○ そのまま書く
  × [リンク](URL) → ○ URLをそのまま貼る
- 箇条書きには「・」を使い、装飾なしで読みやすく整形する
- ユーザーの役に立つURLがあれば、そのまま貼って積極的に提供する

### LINE配信の記憶
ユーザーはLINE配信メッセージを受信している。会話履歴に【LINE配信のお知らせ】として含まれている。
- ユーザーの発言が直近の配信内容に関連していそうなら、その配信を踏まえて応答する。指示語（「これ」「さっきの」「あれ」「この前の」等）に限らず、配信で触れた話題・イベント・告知への反応や質問・感想も対象とする
- 古い配信や会話履歴に無い配信の詳細が必要なときは ${researcher} で調べる
`;

const voiceInstructions = `
## 音声通話の制約

### 応答スタイル（会話のラリー最優先・とにかく軽く短く）
- 短い言葉の往復（ラリー）。**1ターンは1文が基本**。相槌（「うん」「そうなんだ」「なるほど」）だけで返せるならそれで十分
- 固い説明口調にしない。友達と電話するくらい軽くラフに、肩の力を抜いて返す
- 伝える要点は1つだけ。調べた内容も全部は話さず、見出しだけ伝えて「もっと聞く？」と委ねる

### 調べ物（検索）
- 村の情報・最新・時事・天気など事実の質問は、前置きせず直ちに ${voiceAnswerToolName} ツールを1つだけ使う（検索も要点化もこのツールがやる）。
- ツールを呼ぶときは、そのことを発話せずに実行する
- source は必ず指定する。音威子府村ローカルのこと（施設・観光・行政・歴史・イベント・村の店）は knowledge、天気・ニュース・時事・村外の一般的なことは web。迷ったら knowledge。
- ${voiceAnswerToolName} が返すのは素っ気ない事実の要点。それを**ねっぷちゃんらしく短い一文で言い直して**伝える（要点は変えず・長くしない・要点に無い事実は足さない・URLは読まず「ホームページで確認してね」等に）。

### フォーマット（読み上げ前提・絶対厳守）
- 絵文字・記号・マークアップは一切使わない。音声では読めないか不自然に読まれる
  × 絵文字 × **太字** × # 見出し × ・や - のリスト記号 × \`コード\` × [リンク](URL)
- URL・メールアドレスは読み上げない。「ホームページで確認してね」のように口頭で案内する
- 数字や記号は、読み上げて自然な日本語の言い回しにする

### 聞き取り
- 文字起こしの誤変換は文脈から補って解釈する。どうしても聞き取れないときだけ聞き返す

### 通話の終了
- ユーザーが通話を終える意思を示したら（「じゃあね」「切るね」「ばいばい」「ありがとう、もういいよ」等）、短いお別れの一言を返してから ${endCallToolName} ツールを呼んで通話を終える
- お別れの言葉より先にツールを呼ばない。終える意思が曖昧なときは切らずに会話を続ける
- 自分から一方的に通話を切らない
`;

const LAST_MESSAGES = { casual: 6, thinking: 20 } as const;

export const neppChanMemoryOptions = (intent: Intent) =>
  ({
    generateTitle: {
      model: OPENAI_NANO,
      instructions:
        "ユーザーの最初のメッセージから15文字以内の簡潔な日本語タイトルを生成する。",
    },
    workingMemory: {
      enabled: true,
      scope: "resource",
      schema: personaSchema,
    },
    lastMessages: LAST_MESSAGES[intent],
  }) as const;

type Props = Omit<AgentConfig, "id" | "name" | "instructions" | "model"> & {
  isAdmin?: boolean;
  platform?: Platform;
  siteInstructions?: string;
  currentPageUrl?: string;
  modelConfig: AgentModelConfig;
  intent?: Intent;
  withMemory?: boolean;
};

export const createNeppChanAgent = ({
  isAdmin = false,
  platform = "web",
  siteInstructions,
  currentPageUrl,
  modelConfig,
  intent = "thinking",
  withMemory = true,
  ...agentOptions
}: Props) => {
  const agents = getAgents(platform, isAdmin);
  const tools = getTools(platform, isAdmin);
  const researcher = usesResearchTool(platform)
    ? researchToolName
    : "webResearcherAgent";

  const instructions = () =>
    [
      baseInstructions(platform),
      platform === "line" ? lineInstructions(researcher) : "",
      platform === "voice" ? voiceInstructions : "",
      siteInstructions ? `## 設置サイトの文脈\n${siteInstructions}` : "",
      platform === "widget" && currentPageUrl
        ? `## 閲覧中ページの案内
ユーザーが現在表示しているページの URL:
${currentPageUrl}

あなたはこのページに置かれた案内役として振る舞う。
- 「このページ」「ここ」「これ」などは、会話の文脈上ほかの対象が明らかでない限り、閲覧中のページを指すものとして扱う
- 閲覧中のページと質問内容を起点に、掲載情報をわかりやすく説明する
- 必要に応じて、次に行うことや関連ページを具体的に案内する
- ページの分野に合わせて偏りなく対応する
- URL だけを返さず、ユーザーが判断・行動できる要点を添える`
        : "",
      `## 現在の日時\n${getCurrentDateInfo()}`,
      isAdmin ? adminInstructions(researcher) : "",
      platform === "voice" ? "" : sendCheck,
    ]
      .filter(Boolean)
      .join("\n");

  return new Agent({
    id: "nep-chan",
    name: "ねっぷちゃん",
    instructions,
    ...modelConfig,
    agents,
    tools,
    inputProcessors: [
      answerOnLastStep(modelConfig.defaultOptions.maxSteps),
      ...(usesResearchTool(platform) ? researchProcessors : []),
    ],
    ...(withMemory && {
      memory: ({ requestContext }) =>
        getMemoryFromContext(requestContext, neppChanMemoryOptions(intent)),
    }),
    ...agentOptions,
  });
};

export const neppChanAgent = createNeppChanAgent({
  isAdmin: true,
  modelConfig: resolveModelTier({
    intent: "thinking",
    platform: "web",
    isAdmin: true,
  }),
});
