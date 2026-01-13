import {
  ActionBarPrimitive,
  AssistantIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessageRuntime,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { MarkdownText } from "~/components/assistant-ui/MarkdownText";
import { ToolFallback } from "~/components/assistant-ui/ToolFallback";
import { TooltipIconButton } from "~/components/assistant-ui/TooltipIconButton";
import { toolsByName } from "~/components/assistant-ui/tool-uis";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/class-merge";
import { useFeedback } from "~/pages/chat/FeedbackContext";

export const Thread = () => (
  <ThreadPrimitive.Root
    className="aui-root aui-thread-root @container flex h-full flex-col bg-(--color-bg)"
    style={{
      ["--thread-max-width" as string]: "44rem",
    }}
  >
    <ThreadPrimitive.Viewport
      turnAnchor="top"
      className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth px-4 pt-4"
    >
      <AssistantIf condition={({ thread }) => thread.isEmpty}>
        <ThreadWelcome />
      </AssistantIf>

      <ThreadPrimitive.Messages
        components={{
          UserMessage,
          AssistantMessage,
        }}
      />

      <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto flex w-full max-w-(--thread-max-width) flex-col gap-4 overflow-visible pb-4 md:pb-6">
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
      className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible bg-(--color-surface) shadow-md hover:bg-(--color-surface-hover)"
    >
      <ArrowDownIcon />
    </TooltipIconButton>
  </ThreadPrimitive.ScrollToBottom>
);

const ThreadWelcome = () => (
  <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-(--thread-max-width) grow flex-col">
    <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
      <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-4">
        <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in font-semibold text-2xl text-(--color-text) duration-200">
          こんにちは！
        </h1>
        <p className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in text-(--color-text-muted) text-xl delay-75 duration-200">
          音威子府村のことなんでも聞いてね！
        </p>
      </div>
    </div>
    <ThreadSuggestions />
  </div>
);

const SUGGESTIONS = [
  {
    title: "音威子府村ってどんなところ？",
    label: "村の紹介を聞く",
    prompt: "音威子府村について教えて",
  },
  {
    title: "今日の天気は？",
    label: "天気予報を確認",
    prompt: "音威子府村の今日の天気を教えて",
  },
] as const;

const ThreadSuggestions = () => (
  <div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2 pb-4">
    {SUGGESTIONS.map((suggestion, index) => (
      <div
        key={suggestion.prompt}
        className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 @md:nth-[n+3]:block nth-[n+3]:hidden animate-in fill-mode-both duration-200"
        style={{ animationDelay: `${100 + index * 50}ms` }}
      >
        <ThreadPrimitive.Suggestion prompt={suggestion.prompt} send asChild>
          <Button
            variant="ghost"
            className="aui-thread-welcome-suggestion h-auto w-full @md:flex-col flex-wrap items-start justify-start gap-1 rounded-xl border border-(--color-border) px-4 py-3 text-left text-sm transition-all hover:bg-(--color-surface-hover) hover:border-(--color-border-subtle)"
            aria-label={suggestion.prompt}
          >
            <span className="aui-thread-welcome-suggestion-text-1 font-medium text-(--color-text-secondary)">
              {suggestion.title}
            </span>
            <span className="aui-thread-welcome-suggestion-text-2 text-(--color-text-muted)">
              {suggestion.label}
            </span>
          </Button>
        </ThreadPrimitive.Suggestion>
      </div>
    ))}
  </div>
);

const Composer = () => (
  <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
    <ComposerPrimitive.Input
      placeholder="メッセージを入力..."
      className="aui-composer-input mb-1 max-h-32 min-h-14 w-full resize-none rounded-xl border border-(--color-border) bg-(--color-surface) px-4 pt-4 pb-3 text-sm text-(--color-text) outline-none placeholder:text-(--color-text-faint) focus:border-(--color-accent) focus:ring-2 focus:ring-(--color-accent-light)/20 transition-all"
      rows={1}
      autoFocus
      aria-label="メッセージ入力"
    />
    <ComposerAction />
  </ComposerPrimitive.Root>
);

const ComposerAction = () => (
  <div className="aui-composer-action-wrapper absolute right-2 bottom-3 flex items-center">
    <AssistantIf condition={({ thread }) => !thread.isRunning}>
      <ComposerPrimitive.Send asChild>
        <TooltipIconButton
          tooltip="送信"
          side="top"
          type="submit"
          variant="default"
          size="icon"
          className="aui-composer-send size-8 rounded-full bg-(--color-accent) hover:bg-(--color-accent-hover) transition-all active:scale-95"
          aria-label="送信"
        >
          <ArrowUpIcon className="aui-composer-send-icon size-4" />
        </TooltipIconButton>
      </ComposerPrimitive.Send>
    </AssistantIf>

    <AssistantIf condition={({ thread }) => thread.isRunning}>
      <ComposerPrimitive.Cancel asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="aui-composer-cancel size-8 rounded-full"
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
    className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-3 duration-150"
    data-role="assistant"
  >
    <div className="text-xs text-(--color-text-muted) mb-1.5 font-medium">
      ねっぷちゃん
    </div>
    <div className="aui-assistant-message-content wrap-break-word rounded-xl bg-stone-500/3 px-4 py-3 text-(--color-text) leading-relaxed">
      <MessagePrimitive.Parts
        components={{
          Text: MarkdownText,
          tools: { by_name: toolsByName, Fallback: ToolFallback },
        }}
      />
      <MessageError />
    </div>

    <div className="aui-assistant-message-footer mt-2 flex">
      <BranchPicker />
      <AssistantActionBar />
    </div>
  </MessagePrimitive.Root>
);

const FeedbackButtons = () => {
  const { submittedFeedbacks, onFeedbackClick } = useFeedback();
  const messageRuntime = useMessageRuntime();
  const messageId = messageRuntime.getState().id;
  const currentFeedback = submittedFeedbacks[messageId];

  return (
    <>
      <TooltipIconButton
        tooltip="良い回答"
        onClick={() => onFeedbackClick(messageId, "good")}
        className={cn(
          "transition-colors",
          currentFeedback === "good" &&
            "text-(--color-accent) bg-(--color-accent-subtle)",
        )}
      >
        <ThumbsUpIcon />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="改善が必要"
        onClick={() => onFeedbackClick(messageId, "bad")}
        className={cn(
          "transition-colors",
          currentFeedback === "bad" &&
            "text-(--color-danger) bg-(--color-danger-bg)",
        )}
      >
        <ThumbsDownIcon />
      </TooltipIconButton>
    </>
  );
};

const AssistantActionBar = () => (
  <ActionBarPrimitive.Root
    hideWhenRunning
    className="aui-assistant-action-bar-root flex gap-1 text-(--color-text-muted)"
  >
    <ActionBarPrimitive.Copy asChild>
      <TooltipIconButton tooltip="コピー">
        <AssistantIf condition={({ message }) => message.isCopied}>
          <CheckIcon className="text-(--color-success)" />
        </AssistantIf>
        <AssistantIf condition={({ message }) => !message.isCopied}>
          <CopyIcon />
        </AssistantIf>
      </TooltipIconButton>
    </ActionBarPrimitive.Copy>
    <FeedbackButtons />
  </ActionBarPrimitive.Root>
);

const UserMessage = () => (
  <MessagePrimitive.Root
    className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto flex w-full max-w-(--thread-max-width) animate-in justify-end py-3 duration-150"
    data-role="user"
  >
    <div className="aui-user-message-content wrap-break-word max-w-[85%] rounded-2xl rounded-tr-sm bg-(--color-user-message) px-4 py-2.5 text-white shadow-sm">
      <MessagePrimitive.Parts />
    </div>
  </MessagePrimitive.Root>
);

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
