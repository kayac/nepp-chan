type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
};

export const SearchBox = ({ value, onChange, placeholder, label }: Props) => (
  <input
    type="search"
    aria-label={label}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
    className="w-full sm:max-w-xs rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
  />
);
