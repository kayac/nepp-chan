import {
  ActionBarPrimitive,
  AssistantIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessage,
  useMessageRuntime,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  LightbulbIcon,
  SendIcon,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { MarkdownText } from "~/components/assistant-ui/MarkdownText";
import { ToolFallback } from "~/components/assistant-ui/ToolFallback";
import { TooltipIconButton } from "~/components/assistant-ui/TooltipIconButton";
import { toolsByName } from "~/components/assistant-ui/tool-uis";
import { Button } from "~/components/ui/Button";
import { cn } from "~/lib/class-merge";
import { GREETING_PROMPTS } from "~/pages/chat/AssistantProvider";
import { useFeedback } from "~/pages/chat/FeedbackContext";

export const Thread = () => (
  <ThreadPrimitive.Root
    className="aui-root aui-thread-root @container flex h-full flex-col bg-(--color-bg)"
    style={{
      ["--thread-max-width" as string]: "42rem",
    }}
  >
    <ThreadPrimitive.Viewport className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth px-4 pt-6 md:px-6">
      <ThreadPrimitive.Messages
        components={{
          UserMessage,
          AssistantMessage,
        }}
      />

      <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto flex w-full max-w-(--thread-max-width) flex-col gap-4 overflow-visible pb-6 md:pb-8">
        <ThreadScrollToBottom />
        <Composer />
      </ThreadPrimitive.ViewportFooter>
    </ThreadPrimitive.Viewport>
  </ThreadPrimitive.Root>
);

const ThreadScrollToBottom = () => (
  <ThreadPrimitive.ScrollToBottom asChild>
    <TooltipIconButton
      tooltip="下にスクロール"
      variant="outline"
      className="aui-thread-scroll-to-bottom absolute -top-14 z-10 self-center rounded-full p-3 disabled:invisible bg-(--color-surface) hover:bg-(--color-surface-hover) border border-(--color-border) transition-all duration-200 hover:scale-105"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <ArrowDownIcon className="size-4" />
    </TooltipIconButton>
  </ThreadPrimitive.ScrollToBottom>
);

const isTouchDevice =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

const Composer = () => (
  <ComposerPrimitive.Root
    className="aui-composer-root relative flex w-full flex-col"
    style={{ boxShadow: "var(--shadow-card)" }}
  >
    <ComposerPrimitive.Input
      placeholder="メッセージを入力..."
      submitOnEnter={!isTouchDevice}
      className="aui-composer-input mb-1 max-h-36 min-h-[3.5rem] w-full resize-none rounded-2xl border border-(--color-border) bg-(--color-surface) px-5 pt-4 pb-3 pr-14 text-base text-(--color-text) outline-none placeholder:text-(--color-text-faint) focus:border-(--color-accent-light) transition-all duration-200"
      style={{
        boxShadow: "var(--shadow-sm)",
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-input-focus)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
      rows={1}
      autoFocus
      aria-label="メッセージ入力"
    />
    <ComposerAction />
  </ComposerPrimitive.Root>
);

const ComposerAction = () => (
  <div className="aui-composer-action-wrapper absolute right-3 bottom-3 flex items-center">
    <AssistantIf condition={({ thread }) => !thread.isRunning}>
      <ComposerPrimitive.Send asChild>
        <TooltipIconButton
          tooltip="送信"
          side="top"
          type="submit"
          variant="default"
          size="icon"
          className="aui-composer-send size-9 rounded-full bg-(--color-accent) hover:bg-(--color-accent-hover) transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ boxShadow: "var(--shadow-sm)" }}
          aria-label="送信"
        >
          <SendIcon className="aui-composer-send-icon size-4" />
        </TooltipIconButton>
      </ComposerPrimitive.Send>
    </AssistantIf>

    <AssistantIf condition={({ thread }) => thread.isRunning}>
      <ComposerPrimitive.Cancel asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="aui-composer-cancel size-9 rounded-full transition-all duration-200 hover:scale-105"
          aria-label="停止"
        >
          <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
        </Button>
      </ComposerPrimitive.Cancel>
    </AssistantIf>
  </div>
);

const MessageError = () => (
  <MessagePrimitive.Error>
    <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-lg border border-red-200 bg-(--color-danger-bg) p-3 text-(--color-danger) text-sm">
      <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
    </ErrorPrimitive.Root>
  </MessagePrimitive.Error>
);

const AssistantMessage = () => (
  <MessagePrimitive.Root
    className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-4 duration-200"
    data-role="assistant"
  >
    <div className="text-xs text-(--color-text-muted) mb-2 font-medium tracking-wide">
      ねっぷちゃん
    </div>
    <div
      className="aui-assistant-message-content wrap-break-word rounded-2xl bg-(--color-surface) border border-(--color-border)/60 px-5 py-4 text-(--color-text) leading-relaxed"
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      <MessagePrimitive.Parts
        components={{
          Text: MarkdownText,
          tools: { by_name: toolsByName, Fallback: ToolFallback },
        }}
      />
      <MessageError />
    </div>

    <div className="aui-assistant-message-footer mt-2.5 flex">
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
      <TooltipIconButton
        tooltip="良い回答"
        onClick={() => onFeedbackClick(messageId, "good")}
        className="hover:text-(--color-success) transition-colors duration-150"
      >
        <ThumbsUpIcon className="size-3.5" />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="改善が必要"
        onClick={() => onFeedbackClick(messageId, "bad")}
        className="hover:text-(--color-danger) transition-colors duration-150"
      >
        <ThumbsDownIcon className="size-3.5" />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="アイディア"
        onClick={() => onFeedbackClick(messageId, "idea")}
        className="hover:text-(--color-warning) transition-colors duration-150"
      >
        <LightbulbIcon className="size-3.5" />
      </TooltipIconButton>
    </>
  );
};

const AssistantActionBar = () => (
  <ActionBarPrimitive.Root
    hideWhenRunning
    className="aui-assistant-action-bar-root flex gap-0.5 text-(--color-text-faint)"
  >
    <ActionBarPrimitive.Copy asChild>
      <TooltipIconButton
        tooltip="コピー"
        className="hover:text-(--color-accent) transition-colors duration-150"
      >
        <AssistantIf condition={({ message }) => message.isCopied}>
          <CheckIcon className="size-3.5 text-(--color-success)" />
        </AssistantIf>
        <AssistantIf condition={({ message }) => !message.isCopied}>
          <CopyIcon className="size-3.5" />
        </AssistantIf>
      </TooltipIconButton>
    </ActionBarPrimitive.Copy>
    <FeedbackButtons />
  </ActionBarPrimitive.Root>
);

const UserMessage = () => {
  const message = useMessage();
  const isGreeting = message.content?.some(
    (part) => part.type === "text" && GREETING_PROMPTS.includes(part.text),
  );

  if (isGreeting) return null;

  return (
    <MessagePrimitive.Root
      className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto flex w-full max-w-(--thread-max-width) animate-in justify-end py-4 duration-200"
      data-role="user"
    >
      <div
        className="aui-user-message-content wrap-break-word max-w-[80%] rounded-2xl rounded-br-md bg-(--color-user-message) px-5 py-3 text-white/95 leading-relaxed"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <MessagePrimitive.Parts />
      </div>
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
      "aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-(--color-text-muted) text-xs",
      className,
    )}
    {...rest}
  >
    <BranchPickerPrimitive.Previous asChild>
      <TooltipIconButton tooltip="前へ">
        <ChevronLeftIcon />
      </TooltipIconButton>
    </BranchPickerPrimitive.Previous>
    <span className="aui-branch-picker-state font-medium">
      <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
    </span>
    <BranchPickerPrimitive.Next asChild>
      <TooltipIconButton tooltip="次へ">
        <ChevronRightIcon />
      </TooltipIconButton>
    </BranchPickerPrimitive.Next>
  </BranchPickerPrimitive.Root>
);
