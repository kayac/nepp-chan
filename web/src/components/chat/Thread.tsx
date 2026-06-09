import { cn } from "@nepp-chan/shared/lib/class-merge";
import { ArrowDownIcon } from "lucide-react";

import { useChatContext } from "~/app/chat/contexts/ChatContext";

import { AssistantMessage, PendingAssistantMessage } from "./AssistantMessage";
import { Composer } from "./Composer";
import { useStickToBottom } from "./hooks/useStickToBottom";
import { UserMessage } from "./UserMessage";

export const Thread = () => {
  const { messages, isRunning } = useChatContext();
  const { viewportRef, isAtBottom, scrollToBottom } =
    useStickToBottom(messages);
  const showPending =
    isRunning && messages[messages.length - 1]?.role === "user";

  return (
    <div
      className="aui-root aui-thread-root @container relative flex flex-1 min-h-0 flex-col"
      style={{
        ["--thread-max-width" as string]: "42rem",
      }}
    >
      <div
        ref={viewportRef}
        className={cn(
          "aui-thread-viewport relative flex flex-1 flex-col",
          "overflow-x-auto overflow-y-scroll",
          "px-4 md:px-6",
          // 半透明 TopBar 下にメッセージが回り込めるよう、TopBar 高さ + 余白を確保
          "pt-[calc(var(--chat-topbar-h,0px)+1.5rem)]",
        )}
      >
        {messages.map((message, index) => {
          const isLast = index === messages.length - 1;
          if (message.role === "user") {
            return <UserMessage key={message.id} message={message} />;
          }
          if (message.role === "assistant") {
            return (
              <AssistantMessage
                key={message.id}
                message={message}
                isLast={isLast}
              />
            );
          }
          return null;
        })}

        {showPending && <PendingAssistantMessage />}

        <div className="aui-thread-viewport-footer pointer-events-none sticky bottom-0 mx-auto mt-auto flex w-full max-w-(--thread-max-width) flex-col items-center gap-3 overflow-visible pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-4">
          <ThreadScrollToBottom
            isAtBottom={isAtBottom}
            onClick={() => scrollToBottom()}
          />
          <Composer />
        </div>
      </div>
    </div>
  );
};

type ThreadScrollToBottomProps = {
  isAtBottom: boolean;
  onClick: () => void;
};

const ThreadScrollToBottom = ({
  isAtBottom,
  onClick,
}: ThreadScrollToBottomProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={isAtBottom}
    className={cn(
      "aui-thread-scroll-to-bottom pointer-events-auto",
      "size-9 rounded-full grid place-items-center",
      "bg-(--paper-0) border border-(--paper-200) text-(--fg-2)",
      "transition-all duration-200 hover:border-(--teal-300) hover:text-(--teal-700)",
      "disabled:invisible opacity-90 hover:opacity-100",
    )}
    style={{ boxShadow: "var(--shadow-float-sm)" }}
    aria-label="下にスクロール"
  >
    <ArrowDownIcon className="size-3.5" aria-hidden="true" />
  </button>
);
