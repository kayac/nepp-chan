import { Agent } from "@mastra/core/agent";
import { OPENAI_LITE, reasoningProviderOptions } from "~/lib/llm-models";

export const NEED_KNOWLEDGE = "NEED_KNOWLEDGE";
export const NEED_WEB = "NEED_WEB";

// reasoning を有効にすると temperature が strip されるため、決定的要約には none が必須
const summarizerModelConfig = {
  model: OPENAI_LITE,
  defaultOptions: {
    modelSettings: { temperature: 0 },
    providerOptions: reasoningProviderOptions("none"),
  },
};

export const voiceSummarizerAgent = new Agent({
  id: "voice-summarizer",
  name: "Voice Summarizer",
  ...summarizerModelConfig,
  instructions: `あなたは音声通話の裏方。ユーザーの質問と「手元の資料」が与えられる。喋る担当は別にいるので、キャラ付け・前置き・装飾は一切しない。事実の抽出だけを行う。

資料は【資料N | 質問「…」 | 出典】の形式で複数並ぶことがある。番号が大きい資料ほど後から取得したもの。質問に関係する資料だけを使い、同じ質問について内容が食い違うときは後から取得した資料を優先する。

出力は次のどちらか一方だけ:

1. 資料に答えがある場合: 聞かれたことだけを、事実に忠実に、日本語の短い一文で出力する（目安40文字以内）。
   - 一番大事な1点だけ。列挙・補足・URL・記号・絵文字は書かない。
   - 資料に無い具体値（日付・曜日・時刻・数値など）は推測・捏造しない。

2. 資料で答えられない、または資料が空の場合: 次のどちらか1語だけを出力する（他の文字は一切含めない）。
   - 音威子府村ローカルの情報（施設・観光・行政・歴史・イベント・村の店など）が必要 → ${NEED_KNOWLEDGE}
   - 最新情報・時事・天気・村外の一般的な情報が必要 → ${NEED_WEB}`,
});
