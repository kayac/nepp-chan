type Props = {
  message: string;
  className?: string;
};

export const ToolEmptyState = ({
  message,
  className = "rounded-2xl bg-stone-50 p-5 text-stone-600",
}: Props) => <div className={className}>{message}</div>;
