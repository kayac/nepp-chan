type Props = {
  message: string;
  className?: string;
};

export const ToolEmptyState = ({
  message,
  className = "rounded-2xl bg-(--bg-sunken) p-5 text-(--fg-2)",
}: Props) => <div className={className}>{message}</div>;
