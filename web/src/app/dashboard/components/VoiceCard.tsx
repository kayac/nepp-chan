import { cn } from "@nepp-chan/shared/lib/class-merge";

import { formatDateTime, formatMonthDay } from "~/lib/format";
import { getSentimentStyle, sentimentLabel, type Voice } from "~/lib/voice";

interface Props {
  voice: Voice;
  compact?: boolean;
}

export const VoiceCard = ({ voice, compact = false }: Props) => (
  <article
    data-testid="voice-card"
    className={cn(
      "rounded-xl border border-(--border-1) p-4",
      voice.kind === "emergency" ? "bg-(--danger-bg)" : "bg-(--bg-raised)",
    )}
  >
    <div className="flex flex-wrap items-center gap-2 mb-1.5">
      {voice.kind === "emergency" ? (
        <span className="inline-flex px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded">
          緊急
        </span>
      ) : (
        <>
          {voice.topic && (
            <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-teal-50 text-teal-700 rounded">
              {voice.topic}
            </span>
          )}
          {voice.sentiment && (
            <span
              className={cn(
                "inline-flex px-2 py-0.5 text-xs font-medium rounded",
                getSentimentStyle(voice.sentiment),
              )}
            >
              {sentimentLabel(voice.sentiment)}
            </span>
          )}
        </>
      )}
      <span className="text-xs text-(--fg-4) ml-auto whitespace-nowrap">
        {compact ? formatMonthDay(voice.date) : formatDateTime(voice.date)}
      </span>
    </div>
    <p
      className={cn(
        "text-sm text-(--fg-1) whitespace-pre-wrap break-words",
        compact && "line-clamp-2",
      )}
    >
      {voice.content}
    </p>
    {voice.kind === "persona" && voice.attributes.length > 0 && (
      <div className="flex flex-wrap gap-1.5 text-xs pt-2">
        {voice.attributes.map((attr) => (
          <span
            key={attr}
            className="inline-flex px-1.5 py-0.5 bg-(--bg-sunken) text-(--fg-3) rounded"
          >
            {attr}
          </span>
        ))}
      </div>
    )}
    {voice.kind === "emergency" && voice.location && (
      <div className="text-xs text-(--fg-3) pt-2">場所: {voice.location}</div>
    )}
  </article>
);
