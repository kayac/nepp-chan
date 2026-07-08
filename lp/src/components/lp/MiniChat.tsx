import { ChatMarkdown } from "@nepp-chan/shared/components/ChatMarkdown";
import { INITIAL_MESSAGE } from "@nepp-chan/shared/constants/simple-chat";
import { useChatAutoScroll } from "@nepp-chan/shared/hooks/useChatAutoScroll";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { messageText } from "@nepp-chan/shared/lib/message-text";
import { ArrowRightIcon, EllipsisIcon } from "lucide-react";
import { useRef, useState } from "react";
import { MINI_CHAT_QA, type MiniChatQa } from "~/constants/mini-chat-qa";

type Props = {
  webUrl: string;
  iconSrc?: string;
};

export const MiniChat = ({ webUrl, iconSrc = "/mascot/icon.png" }: Props) => {
  const [answered, setAnswered] = useState<MiniChatQa | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);

  useChatAutoScroll(streamRef);

  return (
    <div className="flex flex-col rounded-[28px] border border-(--paper-200) bg-white p-5 shadow-(--shadow-float-md)">
      <div className="flex items-center gap-3 border-b border-(--paper-200) pb-3">
        <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-(--teal-50)">
          <img src={iconSrc} alt="" className="size-[34px] object-contain" />
        </span>
        <div className="flex flex-col">
          <span className="font-(family-name:--font-display) text-sm font-bold text-(--snow-800)">
            ねっぷちゃん
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-(--fg-3)">
            <span className="size-1.5 rounded-full bg-(--success)" />
            オンライン
          </span>
        </div>
        <EllipsisIcon
          className="ml-auto size-3.5 text-(--fg-4)"
          aria-hidden="true"
        />
      </div>

      <div
        ref={streamRef}
        className="flex max-h-[280px] flex-col gap-2 overflow-y-auto py-4"
      >
        <div
          className={cn(
            "w-fit max-w-[78%] break-words rounded-(--r-bubble) px-[18px] py-3 text-sm leading-[1.7]",
            "self-start bg-(--paper-50) text-(--fg-1)",
          )}
        >
          <ChatMarkdown
            text={messageText(INITIAL_MESSAGE)}
            variant="assistant"
          />
        </div>
        {answered && (
          <>
            <div className="w-fit max-w-[78%] break-words self-end rounded-(--r-bubble) bg-(--brand-hover) px-[18px] py-3 text-sm leading-[1.7] text-white">
              <ChatMarkdown text={answered.question} variant="user" />
            </div>
            <div className="w-fit max-w-[78%] break-words self-start rounded-(--r-bubble) bg-(--paper-50) px-[18px] py-3 text-sm leading-[1.7] text-(--fg-1)">
              <ChatMarkdown text={answered.answer} variant="assistant" />
            </div>
          </>
        )}
      </div>

      {!answered && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {MINI_CHAT_QA.map((qa) => (
            <button
              key={qa.question}
              type="button"
              onClick={() => setAnswered(qa)}
              className={cn(
                "rounded-(--r-pill) border border-(--paper-200) bg-white px-3 py-1.5 text-xs text-(--fg-2)",
                "transition-colors duration-150",
                "hover:border-(--teal-300) hover:bg-(--teal-50) hover:text-(--brand)",
              )}
            >
              {qa.question}
            </button>
          ))}
        </div>
      )}

      {answered && (
        <a
          href={webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "mt-3 flex items-center justify-center gap-2 rounded-(--r-pill)",
            "bg-(--brand) px-4 py-3 text-sm font-bold text-white shadow-(--shadow-brand)",
            "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "hover:-translate-y-0.5 hover:bg-(--brand-hover)",
          )}
        >
          続きはチャットでお話しよう
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </a>
      )}
    </div>
  );
};
