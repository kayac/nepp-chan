import {
  ActionBarPrimitive,
  AssistantIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useComposerRuntime,
  useMessage,
  useMessageRuntime,
} from "@assistant-ui/react";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { Button } from "@nepp-chan/shared/ui/Button";
import {
  ArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LightbulbIcon,
  SendIcon,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { GREETING_PROMPT } from "~/app/chat/AssistantProvider";
import { SpeechBubble } from "~/app/chat/components/SpeechBubble";
import { useFeedback } from "~/app/chat/FeedbackContext";
import { MarkdownText } from "~/components/assistant-ui/MarkdownText";
import { ToolFallback } from "~/components/assistant-ui/ToolFallback";
import { toolsByName } from "~/components/assistant-ui/tool-uis";

export const Thread = () => (
  <ThreadPrimitive.Root
    className="aui-root aui-thread-root @container relative flex flex-1 min-h-0 flex-col"
    style={{
      ["--thread-max-width" as string]: "42rem",
    }}
  >
    <ThreadPrimitive.Viewport
      className={cn(
        "aui-thread-viewport relative flex flex-1 flex-col scroll-smooth",
        "overflow-x-auto overflow-y-scroll",
        "px-4 md:px-6",
        // 半透明 TopBar 下にメッセージが回り込めるよう、TopBar 高さ + 余白を確保
        "pt-[calc(var(--chat-topbar-h,0px)+1.5rem)]",
      )}
    >
      <ThreadPrimitive.Messages
        components={{
          UserMessage,
          AssistantMessage,
        }}
      />

      <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer pointer-events-none sticky bottom-0 mx-auto mt-auto flex w-full max-w-(--thread-max-width) flex-col items-center gap-3 overflow-visible pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-4">
        <ThreadScrollToBottom />
        <Composer />
      </ThreadPrimitive.ViewportFooter>
    </ThreadPrimitive.Viewport>
  </ThreadPrimitive.Root>
);

const ThreadScrollToBottom = () => (
  <ThreadPrimitive.ScrollToBottom asChild>
    <button
      type="button"
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
  </ThreadPrimitive.ScrollToBottom>
);

const isTouchDevice =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

const Composer = () => {
  const composerRuntime = useComposerRuntime();
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // タッチデバイスでは Enter で改行、送信ボタンで送信
    if (isTouchDevice) return;
    if (e.key !== "Enter" || e.shiftKey) return;
    // IME 変換中の Enter は送信せず、変換確定として扱う
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    composerRuntime.send();
  };

  return (
    <ComposerPrimitive.Root
      className={cn(
        "aui-composer-root pointer-events-auto",
        "relative flex w-full items-center gap-2",
        "rounded-(--r-footer) border-2 border-(--teal-500) bg-(--paper-0)",
        "px-5 py-2.5",
      )}
      style={{ boxShadow: "var(--shadow-floating-input)" }}
    >
      <ComposerPrimitive.Input
        placeholder="ねっぷちゃんに話しかける…"
        submitOnEnter={false}
        className={cn(
          "aui-composer-input flex-1 resize-none border-0 bg-transparent outline-none",
          "px-1 py-2 text-base text-(--fg-1) placeholder:text-(--fg-4) leading-snug",
          "min-h-[24px] max-h-32",
        )}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          if (isTouchDevice) {
            setTimeout(() => {
              e.target.scrollIntoView({ behavior: "smooth", block: "end" });
            }, 300);
          }
        }}
        rows={1}
        autoFocus
        aria-label="メッセージ入力"
      />
      <ComposerAction />
    </ComposerPrimitive.Root>
  );
};

const ComposerAction = () => (
  <div className="aui-composer-action-wrapper flex items-center flex-none">
    <AssistantIf condition={({ thread }) => !thread.isRunning}>
      <ComposerPrimitive.Send asChild>
        <button
          type="submit"
          aria-label="送信"
          className={cn(
            "aui-composer-send size-10 rounded-full grid place-items-center",
            "bg-(--teal-700) text-(--paper-0)",
            "transition-colors hover:bg-(--teal-800)",
            "disabled:bg-(--paper-100) disabled:text-(--fg-4)",
          )}
          style={{ boxShadow: "0 4px 12px rgba(15, 118, 110, 0.35)" }}
        >
          <SendIcon className="aui-composer-send-icon size-4" />
        </button>
      </ComposerPrimitive.Send>
    </AssistantIf>

    <AssistantIf condition={({ thread }) => thread.isRunning}>
      <ComposerPrimitive.Cancel asChild>
        <button
          type="button"
          aria-label="停止"
          className={cn(
            "aui-composer-cancel size-10 rounded-full grid place-items-center",
            "bg-(--paper-100) text-(--fg-2) transition-colors hover:bg-(--paper-200)",
          )}
        >
          <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
        </button>
      </ComposerPrimitive.Cancel>
    </AssistantIf>
  </div>
);

const MessageError = () => (
  <MessagePrimitive.Error>
    <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-lg border border-red-200 bg-(--danger-bg) p-3 text-(--danger) text-sm">
      <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
    </ErrorPrimitive.Root>
  </MessagePrimitive.Error>
);

const AssistantMessage = () => (
  <MessagePrimitive.Root
    className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-4 duration-200"
    data-role="assistant"
  >
    <div className="text-xs text-(--fg-3) mb-2 font-(family-name:--font-display) tracking-wide pl-1">
      ねっぷちゃん
    </div>
    <div className="flex justify-start">
      <SpeechBubble
        variant="assistant"
        className="max-w-[92%] md:max-w-[88%] py-4"
      >
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            tools: { by_name: toolsByName, Fallback: ToolFallback },
          }}
        />
        <MessageError />
      </SpeechBubble>
    </div>

    <div className="aui-assistant-message-footer mt-4 flex pl-1">
      <BranchPicker />
      <AssistantActionBar />
    </div>
  </MessagePrimitive.Root>
);

const FeedbackButtons = () => {
  const { onFeedbackClick } = useFeedback();
  const messageRuntime = useMessageRuntime();
  const messageId = messageRuntime.getState().id;

  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="良い回答"
        onClick={() => onFeedbackClick(messageId, "good")}
        className="hover:text-(--success) transition-colors duration-150"
      >
        <ThumbsUpIcon className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="改善が必要"
        onClick={() => onFeedbackClick(messageId, "bad")}
        className="hover:text-(--danger) transition-colors duration-150"
      >
        <ThumbsDownIcon className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="アイディア"
        onClick={() => onFeedbackClick(messageId, "idea")}
        className="hover:text-(--warning) transition-colors duration-150"
      >
        <LightbulbIcon className="size-3.5" />
      </Button>
    </>
  );
};

const AssistantActionBar = () => (
  <ActionBarPrimitive.Root
    hideWhenRunning
    className="aui-assistant-action-bar-root flex items-center gap-1.5 text-(--fg-4)"
  >
    <span className="text-xs text-(--fg-3)">この回答は役に立ちましたか？</span>
    <FeedbackButtons />
  </ActionBarPrimitive.Root>
);

const UserMessage = () => {
  const message = useMessage();
  const isGreeting = message.content?.some(
    (part) => part.type === "text" && part.text === GREETING_PROMPT,
  );

  if (isGreeting) return null;

  return (
    <MessagePrimitive.Root
      className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto flex w-full max-w-(--thread-max-width) animate-in justify-end py-4 duration-200"
      data-role="user"
    >
      <SpeechBubble variant="user" className="max-w-[80%]">
        <MessagePrimitive.Parts />
      </SpeechBubble>
    </MessagePrimitive.Root>
  );
};

const BranchPicker = ({
  className,
  ...rest
}: BranchPickerPrimitive.Root.Props) => (
  <BranchPickerPrimitive.Root
    hideWhenSingleBranch
    className={cn(
      "aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-(--fg-3) text-xs",
      className,
    )}
    {...rest}
  >
    <BranchPickerPrimitive.Previous asChild>
      <Button variant="ghost" size="icon-xs" aria-label="前へ">
        <ChevronLeftIcon />
      </Button>
    </BranchPickerPrimitive.Previous>
    <span className="aui-branch-picker-state font-medium">
      <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
    </span>
    <BranchPickerPrimitive.Next asChild>
      <Button variant="ghost" size="icon-xs" aria-label="次へ">
        <ChevronRightIcon />
      </Button>
    </BranchPickerPrimitive.Next>
  </BranchPickerPrimitive.Root>
);
