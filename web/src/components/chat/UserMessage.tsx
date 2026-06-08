import type { UIMessage } from "ai";

import { GREETING_PROMPT } from "~/app/chat/ChatProvider";
import { SpeechBubble } from "~/app/chat/components/SpeechBubble";
import { getMessageContent } from "~/app/chat/feedback-helpers";

export const UserMessage = ({ message }: { message: UIMessage }) => {
  const text = getMessageContent(message);

  if (text === GREETING_PROMPT) return null;

  return (
    <div
      className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto flex w-full max-w-(--thread-max-width) animate-in justify-end py-4 duration-200"
      data-role="user"
    >
      <SpeechBubble variant="user" className="max-w-[80%]">
        <span className="whitespace-pre-wrap">{text}</span>
      </SpeechBubble>
    </div>
  );
};
