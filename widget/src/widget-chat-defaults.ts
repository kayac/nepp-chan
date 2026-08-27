import type { UIMessage } from "ai";

export const WIDGET_INITIAL_MESSAGE: UIMessage = {
  id: "initial-greeting",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "こんにちは〜！ねっぷちゃんだよ 😊\n音威子府のことなら、なんでも聞いてみてね！",
    },
  ],
};
