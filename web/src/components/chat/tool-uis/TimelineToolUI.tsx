import { cn } from "@nepp-chan/shared/lib/class-merge";
import {
  type DisplayTimelineArgs,
  displayTimelineSchema,
} from "@nepp-chan/shared/schemas/display-tools";
import { ToolLoadingState } from "@nepp-chan/shared/ui/Loading";
import { CalendarIcon } from "lucide-react";

import { defineToolUI } from "./define-tool-ui";

type TimelineEvent = DisplayTimelineArgs["events"][number];

const getStatusColor = (status?: TimelineEvent["status"]) => {
  switch (status) {
    case "completed":
      return "border-(--moss-500) bg-(--moss-50)";
    case "current":
      return "border-(--teal-500) bg-(--brand-soft) ring-2 ring-(--teal-200)";
    default:
      return "border-(--border-2) bg-(--bg-sunken)";
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
      <div className="absolute left-[7px] top-6 h-[calc(100%+1rem)] w-0.5 bg-(--border-1)" />
    )}

    {/* Status indicator */}
    <div
      className={cn(
        "relative z-10 mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
        getStatusColor(event.status),
      )}
    >
      {event.status === "completed" && (
        <div className="size-2 rounded-full bg-(--moss-500)" />
      )}
      {event.status === "current" && (
        <div className="size-2 animate-pulse rounded-full bg-(--teal-500)" />
      )}
    </div>

    {/* Content */}
    <div className="min-w-0 flex-1 pb-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-(--fg-3)">{event.date}</span>
        {event.type === "milestone" && (
          <span className="rounded-full bg-(--warning-bg) px-2 py-0.5 text-xs text-(--warning)">
            マイルストーン
          </span>
        )}
        {event.type === "deadline" && (
          <span className="rounded-full bg-(--danger-bg) px-2 py-0.5 text-xs text-(--danger)">
            締切
          </span>
        )}
      </div>
      <h4
        className={cn(
          "mt-1 font-medium",
          event.status === "completed" ? "text-(--fg-3)" : "text-(--fg-1)",
        )}
      >
        {event.title}
      </h4>
      {event.description && (
        <p className="mt-1 text-sm text-(--fg-2)">{event.description}</p>
      )}
    </div>
  </div>
);

const Timeline = ({ args }: { args: DisplayTimelineArgs }) => (
  <div className="rounded-xl bg-(--bg-raised) p-4 shadow-sm ring-1 ring-(--border-1)">
    {args.title && (
      <div className="mb-4 flex items-center gap-2 border-b border-(--border-1) pb-3">
        <CalendarIcon className="size-5 text-(--brand)" />
        <h3 className="font-medium text-(--fg-2)">{args.title}</h3>
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

export const DisplayTimelineToolComponent = defineToolUI({
  schema: displayTimelineSchema,
  loading: (
    <ToolLoadingState
      variant="timeline"
      icon={<CalendarIcon className="size-5 animate-pulse text-(--teal-400)" />}
    />
  ),
  emptyMessage: "表示するイベントがありません",
  isEmpty: (args) => args.events.length === 0,
  Component: Timeline,
});
