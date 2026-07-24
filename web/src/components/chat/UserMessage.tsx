import { SpeechBubble } from "@nepp-chan/shared/components/SpeechBubble";
import { messageText } from "@nepp-chan/shared/lib/message-text";
import type { UIMessage } from "ai";
import { isGreetingPrompt } from "~/app/chat/greeting-prompt";

export const UserMessage = ({ message }: { message: UIMessage }) => {
  const text = messageText(message);

  if (isGreetingPrompt(text)) return null;

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
