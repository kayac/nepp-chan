interface Props<T extends string> {
  label: string;
  tabs: readonly { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}

export const FolderTabs = <T extends string>({
  label,
  tabs,
  selected,
  onSelect,
}: Props<T>) => (
  <div
    role="tablist"
    aria-label={label}
    className="flex border-b border-stone-300 divide-x divide-stone-300"
  >
    {tabs.map((tab) => (
      <button
        key={tab.value}
        type="button"
        role="tab"
        aria-selected={selected === tab.value}
        onClick={() => onSelect(tab.value)}
        className={`px-4 py-2 -mb-px text-sm font-medium border-t border-b border-stone-300 rounded-t-lg first:border-l last:border-r transition-colors ${
          selected === tab.value
            ? "border-b-white bg-white text-stone-800"
            : "border-b-transparent bg-stone-100 text-stone-600 hover:text-stone-800"
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
