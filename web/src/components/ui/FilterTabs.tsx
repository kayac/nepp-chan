type Props<T extends string> = {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
};

export const FilterTabs = <T extends string>({
  options,
  value,
  onChange,
}: Props<T>) => (
  <div className="flex flex-wrap gap-1">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
          value === option.value
            ? "bg-stone-800 text-white"
            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);
