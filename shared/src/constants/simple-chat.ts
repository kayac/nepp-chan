import type { UIMessage } from "ai";

export const SIMPLE_CHAT_MAX_MESSAGES = 10;

export const SAMPLE_QUESTIONS: ReadonlyArray<string> = [
  "移住の補助金はある？",
  "音威子府駅ってどんなところ？",
  "おすすめのお蕎麦屋さんは？",
  "今日のゴミの日は？",
];

export const INITIAL_MESSAGE: UIMessage = {
  id: "initial-greeting",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "こんにちは〜！ねっぷちゃんだよ 😊\n音威子府のことなら、なんでも聞いてみてね！",
    },
  ],
};
