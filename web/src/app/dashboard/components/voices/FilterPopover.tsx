import { FunnelIcon } from "@heroicons/react/24/outline";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { useState } from "react";
import {
  appliedCount,
  DEFAULT_FILTER,
  PERIOD_OPTIONS,
  SEG_OPTIONS,
  SENT_OPTIONS,
  TOPIC_OPTIONS,
  type VoiceFilter,
} from "./helpers";

interface Props {
  filter: VoiceFilter;
  matchCount: number | null;
  onChange: (next: VoiceFilter) => void;
}

const Pill = ({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 rounded-(--r-pill) text-sm transition-colors",
      selected
        ? "bg-(--brand) text-(--fg-on-brand) font-medium"
        : "bg-(--bg-sunken) text-(--fg-2) hover:bg-(--brand-soft)",
    )}
  >
    {label}
  </button>
);

const Group = ({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) => (
  <div>
    <p className="text-xs font-semibold text-(--fg-3) mb-1.5">
      {label}
      {note && <span className="font-normal ml-1.5">{note}</span>}
    </p>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);

const toggle = <T,>(values: T[], value: T) =>
  values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];

export const FilterPopover = ({ filter, matchCount, onChange }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const count = appliedCount(filter);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-(--r-pill) border border-(--border-1) bg-(--bg-raised) text-sm font-medium text-(--fg-1) hover:bg-(--bg-sunken) transition-colors"
      >
        <FunnelIcon className="w-4 h-4" aria-hidden="true" />
        {count > 0 ? `絞り込む（${count}）` : "絞り込む"}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="絞り込みを閉じる"
          />
          <div className="absolute left-0 top-full mt-2 z-20 w-[min(26rem,calc(100vw-2rem))] bg-(--bg-raised) border border-(--border-1) rounded-xl shadow-(--shadow-lg) p-4 space-y-4">
            <Group label="いつの声か">
              {PERIOD_OPTIONS.map((o) => (
                <Pill
                  key={o.value}
                  label={o.label}
                  selected={filter.period === o.value}
                  onClick={() => onChange({ ...filter, period: o.value })}
                />
              ))}
            </Group>

            <Group label="どんな声か" note="複数選べます">
              {SENT_OPTIONS.map((o) => (
                <Pill
                  key={o.value}
                  label={o.label}
                  selected={filter.sents.includes(o.value)}
                  onClick={() =>
                    onChange({
                      ...filter,
                      sents: toggle(filter.sents, o.value),
                    })
                  }
                />
              ))}
            </Group>

            <Group label="誰の声か" note="複数選べます">
              {SEG_OPTIONS.map((o) => (
                <Pill
                  key={o.value}
                  label={o.label}
                  selected={filter.segs.includes(o.value)}
                  onClick={() =>
                    onChange({ ...filter, segs: toggle(filter.segs, o.value) })
                  }
                />
              ))}
            </Group>

            <Group label="話題">
              <Pill
                label="すべて"
                selected={filter.topic === null}
                onClick={() => onChange({ ...filter, topic: null })}
              />
              {TOPIC_OPTIONS.map((topic) => (
                <Pill
                  key={topic}
                  label={topic}
                  selected={filter.topic === topic}
                  onClick={() => onChange({ ...filter, topic })}
                />
              ))}
            </Group>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-(--border-1)">
              <button
                type="button"
                onClick={() =>
                  onChange({ ...DEFAULT_FILTER, sort: filter.sort })
                }
                className="text-sm text-(--fg-3) hover:text-(--fg-1)"
              >
                すべて解除
              </button>
              <div className="flex items-center gap-3">
                {matchCount !== null && (
                  <span className="text-sm text-(--fg-2)">
                    {matchCount}件が該当
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-1.5 rounded-(--r-pill) bg-(--brand) text-(--fg-on-brand) text-sm font-medium hover:bg-(--brand-press)"
                >
                  この条件で見る
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
