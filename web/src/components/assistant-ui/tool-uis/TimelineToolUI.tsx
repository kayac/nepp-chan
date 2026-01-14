import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { CalendarIcon } from "lucide-react";

import { ToolEmptyState } from "~/components/ui/emptyState";
import { ToolLoadingState } from "~/components/ui/loading";
import { cn } from "~/lib/class-merge";

type TimelineEvent = {
  date: string;
  title: string;
  description?: string;
  status?: "completed" | "current" | "upcoming";
  type?: "event" | "milestone" | "deadline";
};

type TimelineArgs = {
  title?: string;
  events: TimelineEvent[];
};

type TimelineResult = {
  displayed: boolean;
};

const getStatusColor = (status?: TimelineEvent["status"]) => {
  switch (status) {
    case "completed":
      return "border-green-500 bg-green-50";
    case "current":
      return "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200";
    default:
      return "border-gray-300 bg-gray-50";
  }
};

const TimelineItem = ({
  event,
  isLast,
}: {
  event: TimelineEvent;
  isLast: boolean;
}) => (
  <div className="relative flex gap-4">
    {/* Timeline line */}
    {!isLast && (
      <div className="absolute left-[7px] top-6 h-[calc(100%+1rem)] w-0.5 bg-gray-200" />
    )}

    {/* Status indicator */}
    <div
      className={cn(
        "relative z-10 mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
        getStatusColor(event.status),
      )}
    >
      {event.status === "completed" && (
        <div className="size-2 rounded-full bg-green-500" />
      )}
      {event.status === "current" && (
        <div className="size-2 animate-pulse rounded-full bg-indigo-500" />
      )}
    </div>

    {/* Content */}
    <div className="min-w-0 flex-1 pb-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">{event.date}</span>
        {event.type === "milestone" && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            マイルストーン
          </span>
        )}
        {event.type === "deadline" && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
            締切
          </span>
        )}
      </div>
      <h4
        className={cn(
          "mt-1 font-medium",
          event.status === "completed" ? "text-gray-500" : "text-gray-800",
        )}
      >
        {event.title}
      </h4>
      {event.description && (
        <p className="mt-1 text-sm text-gray-600">{event.description}</p>
      )}
    </div>
  </div>
);

const Timeline = ({ args }: { args: TimelineArgs }) => (
  <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
    {args.title && (
      <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
        <CalendarIcon className="size-5 text-indigo-500" />
        <h3 className="font-medium text-gray-700">{args.title}</h3>
      </div>
    )}

    <div className="space-y-0">
      {args.events.map((event, index) => (
        <TimelineItem
          key={`${event.date}-${event.title}`}
          event={event}
          isLast={index === args.events.length - 1}
        />
      ))}
    </div>
  </div>
);

const renderTimeline = (args: TimelineArgs, isRunning: boolean) => {
  if (isRunning && !args.events) {
    return (
      <div className="my-4">
        <ToolLoadingState
          variant="timeline"
          icon={
            <CalendarIcon className="size-5 animate-pulse text-indigo-400" />
          }
        />
      </div>
    );
  }

  if (!args.events || args.events.length === 0) {
    return (
      <div className="my-4">
        <ToolEmptyState message="表示するイベントがありません" />
      </div>
    );
  }

  return (
    <div className="my-4">
      <Timeline args={args} />
    </div>
  );
};

/**
 * MessagePrimitive.Parts の tools.by_name で使用するコンポーネント
 */
export const DisplayTimelineToolComponent: ToolCallMessagePartComponent = ({
  args,
  status,
}) =>
  renderTimeline(args as unknown as TimelineArgs, status?.type === "running");

export const TimelineToolUI = makeAssistantToolUI<TimelineArgs, TimelineResult>(
  {
    toolName: "displayTimelineTool",
    render: ({ args, status }) =>
      renderTimeline(args, status.type === "running"),
  },
);
