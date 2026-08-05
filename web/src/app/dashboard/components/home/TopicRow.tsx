export interface TopicChip {
  tag: string;
  count: number;
}

interface Props {
  topic: string;
  count: number;
  chips: TopicChip[];
  sample: string | null;
  onShowVoices: (topic: string) => void;
}

export const TopicRow = ({
  topic,
  count,
  chips,
  sample,
  onShowVoices,
}: Props) => (
  <li data-testid="topic-row">
    <button
      type="button"
      onClick={() => onShowVoices(topic)}
      className="w-full text-left py-2.5 px-2 -mx-2 rounded-(--r-md) hover:bg-(--bg-sunken) transition-colors"
    >
      <span className="flex items-baseline gap-2">
        <span className="text-sm font-bold text-(--fg-1)">{topic}</span>
        <span className="ml-auto text-xs text-(--fg-3)">{count}件</span>
        <span className="text-xs text-(--fg-4)" aria-hidden="true">
          →
        </span>
      </span>
      {chips.length > 0 && (
        <span
          data-testid="topic-chips"
          className="mt-1.5 flex flex-wrap gap-1.5"
        >
          {chips.map((chip) => (
            <span
              key={chip.tag}
              className="text-xs rounded-(--r-pill) px-2.5 py-0.5 bg-(--bg-sunken) text-(--fg-3)"
            >
              {chip.tag} ×{chip.count}
            </span>
          ))}
        </span>
      )}
      {sample && (
        <span className="mt-1.5 block text-sm text-(--fg-3) line-clamp-2">
          「{sample}」
        </span>
      )}
    </button>
  </li>
);
