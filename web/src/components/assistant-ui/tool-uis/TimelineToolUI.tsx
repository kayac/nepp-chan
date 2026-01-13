import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { CalendarIcon } from "lucide-react";
import type { FC } from "react";

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

const LoadingState: FC = () => (
  <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 p-4">
    <div className="flex items-center gap-2">
      <CalendarIcon className="size-5 animate-pulse text-indigo-400" />
      <div className="h-4 w-32 animate-pulse rounded bg-indigo-200" />
    </div>
    <div className="mt-4 space-y-4 pl-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="size-3 animate-pulse rounded-full bg-indigo-200" />
          <div className="flex-1 space-y-1">
            <div className="h-4 w-24 animate-pulse rounded bg-indigo-200" />
            <div className="h-3 w-48 animate-pulse rounded bg-indigo-100" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

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

const TimelineItem: FC<{ event: TimelineEvent; isLast: boolean }> = ({
  event,
  isLast,
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

const Timeline: FC<{ args: TimelineArgs }> = ({ args }) => (
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

/**
 * MessagePrimitive.Parts の tools.by_name で使用するコンポーネント
 */
export const DisplayTimelineToolComponent: ToolCallMessagePartComponent = ({
  args,
  status,
}) => {
  const timelineArgs = args as unknown as TimelineArgs;

  if (status?.type === "running" && !timelineArgs.events) {
    return <LoadingState />;
  }

  if (!timelineArgs.events || timelineArgs.events.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 p-4 text-gray-600">
        表示するイベントがありません
      </div>
    );
  }

  return <Timeline args={timelineArgs} />;
};

export const TimelineToolUI = makeAssistantToolUI<TimelineArgs, TimelineResult>(
  {
    toolName: "displayTimelineTool",
    render: ({ args, status }) => {
      if (status.type === "running" && !args.events) {
        return <LoadingState />;
      }

      if (!args.events || args.events.length === 0) {
        return (
          <div className="rounded-xl bg-gray-50 p-4 text-gray-600">
            表示するイベントがありません
          </div>
        );
      }

      return <Timeline args={args} />;
    },
  },
);
