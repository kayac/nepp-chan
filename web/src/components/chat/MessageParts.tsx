import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";

import { MarkdownText } from "./MarkdownText";
import { ToolPart } from "./ToolPart";

type Props = {
  message: UIMessage;
};

/** message parts を種類ごとの表示コンポーネントへ振り分ける */
export const MessageParts = ({ message }: Props) =>
  message.parts.map((part, index) => {
    if (part.type === "text") {
      return (
        <MarkdownText
          // biome-ignore lint/suspicious/noArrayIndexKey: テキストパートに安定 ID が無く、順序も不変なため位置で識別する
          key={`${message.id}-text-${index}`}
          text={part.text}
        />
      );
    }
    if (isToolUIPart(part)) {
      return <ToolPart key={part.toolCallId} part={part} />;
    }
    return null;
  });
