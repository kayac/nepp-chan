interface Props {
  label: string;
  onClick: () => void;
}

export const LinkButton = ({ label, onClick }: Props) => (
  <button
    type="button"
    onClick={onClick}
    className="text-sm font-medium text-(--brand) hover:text-(--brand-press) shrink-0"
  >
    {label} →
  </button>
);
