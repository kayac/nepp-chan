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
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  LightbulbIcon,
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
      ["--thread-max-width" as string]: "44rem",
    }}
  >
    <ThreadPrimitive.Viewport className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth px-4 pt-4">
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

const Composer = () => (
  <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
    <ComposerPrimitive.Input
      placeholder="メッセージを入力..."
      className="aui-composer-input mb-1 max-h-32 min-h-14 w-full resize-none rounded-xl border border-(--color-border) bg-(--color-surface) px-4 pt-4 pb-3 text-base text-(--color-text) outline-none placeholder:text-(--color-text-faint) focus:border-(--color-accent) focus:ring-2 focus:ring-(--color-accent-light)/20 transition-all"
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
  const { onFeedbackClick } = useFeedback();
  const messageRuntime = useMessageRuntime();
  const messageId = messageRuntime.getState().id;

  return (
    <>
      <TooltipIconButton
        tooltip="良い回答"
        onClick={() => onFeedbackClick(messageId, "good")}
      >
        <ThumbsUpIcon />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="改善が必要"
        onClick={() => onFeedbackClick(messageId, "bad")}
      >
        <ThumbsDownIcon />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="アイディア"
        onClick={() => onFeedbackClick(messageId, "idea")}
      >
        <LightbulbIcon />
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

const UserMessage = () => {
  const message = useMessage();
  const isGreeting = message.content?.some(
    (part) => part.type === "text" && GREETING_PROMPTS.includes(part.text),
  );

  if (isGreeting) return null;

  return (
    <MessagePrimitive.Root
      className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto flex w-full max-w-(--thread-max-width) animate-in justify-end py-3 duration-150"
      data-role="user"
    >
      <div className="aui-user-message-content wrap-break-word max-w-[85%] rounded-2xl rounded-tr-sm bg-(--color-user-message) px-4 py-2.5 text-white shadow-sm">
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
