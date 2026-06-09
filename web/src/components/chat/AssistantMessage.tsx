import { Button } from "@nepp-chan/shared/ui/Button";
import type { UIMessage } from "ai";
import { isToolOrDynamicToolUIPart } from "ai";
import { LightbulbIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useState } from "react";

import { FeedbackModal } from "~/app/chat/components/FeedbackModal";
import { SpeechBubble } from "~/app/chat/components/SpeechBubble";
import { useChatContext } from "~/app/chat/useChatContext";
import type { FeedbackRating } from "~/types";

import { MarkdownText } from "./MarkdownText";
import { ToolPart } from "./ToolPart";

type Props = {
  message: UIMessage;
  isLast: boolean;
};

const AssistantHeader = () => (
  <div className="flex items-center gap-1.5 mb-2 pl-1">
    <img
      src="/mascot/icon.png"
      alt=""
      aria-hidden="true"
      className="size-6 rounded-full bg-(--teal-50) object-cover"
    />
    <span className="text-xs text-(--fg-3) font-(family-name:--font-display) tracking-wide">
      ねっぷちゃん
    </span>
  </div>
);

const TypingDot = () => (
  <span className="aui-typing-dot mx-1 animate-pulse">●</span>
);

export const PendingAssistantMessage = () => (
  <div
    className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-4 duration-200"
    data-role="assistant"
  >
    <AssistantHeader />
    <div className="flex justify-start">
      <SpeechBubble
        variant="assistant"
        className="max-w-[92%] md:max-w-[88%] py-4"
      >
        <TypingDot />
      </SpeechBubble>
    </div>
  </div>
);

export const AssistantMessage = ({ message, isLast }: Props) => {
  const { isRunning, error } = useChatContext();
  const hideActionBar = isRunning && isLast;
  const hasVisibleContent = message.parts.some(
    (p) =>
      (p.type === "text" && p.text.length > 0) || isToolOrDynamicToolUIPart(p),
  );
  const showTypingDot = isLast && isRunning && !hasVisibleContent;

  return (
    <div
      className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-4 duration-200"
      data-role="assistant"
    >
      <AssistantHeader />
      <div className="flex justify-start">
        <SpeechBubble
          variant="assistant"
          className="max-w-[92%] md:max-w-[88%] py-4"
        >
          {message.parts.map((part, index) => {
            if (part.type === "text") {
              return (
                <MarkdownText
                  // biome-ignore lint/suspicious/noArrayIndexKey: テキストパートに安定 ID が無く、順序も不変なため位置で識別する
                  key={`${message.id}-text-${index}`}
                  text={part.text}
                />
              );
            }
            if (isToolOrDynamicToolUIPart(part)) {
              return <ToolPart key={part.toolCallId} part={part} />;
            }
            return null;
          })}
          {showTypingDot && <TypingDot />}
          {isLast && error && <MessageError message={error.message} />}
        </SpeechBubble>
      </div>

      {!hideActionBar && (
        <div className="aui-assistant-message-footer mt-4 flex pl-1">
          <AssistantActionBar messageId={message.id} />
        </div>
      )}
    </div>
  );
};

const MessageError = ({ message }: { message: string }) => (
  <div className="aui-message-error-root mt-2 rounded-lg border border-red-200 bg-(--danger-bg) p-3 text-(--danger) text-sm">
    <p className="aui-message-error-message line-clamp-2">{message}</p>
  </div>
);

const AssistantActionBar = ({ messageId }: { messageId: string }) => {
  const [rating, setRating] = useState<FeedbackRating | null>(null);

  return (
    <div className="aui-assistant-action-bar-root flex items-center gap-1.5 text-(--fg-4)">
      <span className="text-xs text-(--fg-3)">
        この回答は役に立ちましたか？
      </span>
      <FeedbackButtons onSelect={setRating} />
      {rating !== null && (
        <FeedbackModal
          key={rating}
          messageId={messageId}
          rating={rating}
          onClose={() => setRating(null)}
        />
      )}
    </div>
  );
};

const FeedbackButtons = ({
  onSelect,
}: {
  onSelect: (rating: FeedbackRating) => void;
}) => (
  <>
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="良い回答"
      onClick={() => onSelect("good")}
      className="hover:text-(--success) transition-colors duration-150"
    >
      <ThumbsUpIcon className="size-3.5" />
    </Button>
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="改善が必要"
      onClick={() => onSelect("bad")}
      className="hover:text-(--danger) transition-colors duration-150"
    >
      <ThumbsDownIcon className="size-3.5" />
    </Button>
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="アイディア"
      onClick={() => onSelect("idea")}
      className="hover:text-(--warning) transition-colors duration-150"
    >
      <LightbulbIcon className="size-3.5" />
    </Button>
  </>
);
