import { formatCostJpy } from "./helpers";

interface Props {
  daily: { date: string; costUsd: number }[];
}

export const CostSparkline = ({ daily }: Props) => {
  const max = daily.reduce((m, d) => Math.max(m, d.costUsd), 0);
  if (max === 0) return null;

  const last = daily.at(-1);

  return (
    <div className="flex items-end gap-0.5 h-11">
      {daily.map((day, index) => (
        <div
          key={day.date}
          title={`${day.date} ${formatCostJpy(day.costUsd)}`}
          className={`flex-1 min-w-0.5 rounded-t-sm ${
            index === daily.length - 1
              ? "bg-(--brand-hover)"
              : "bg-(--brand-soft-2)"
          }`}
          style={{ height: `${Math.max((day.costUsd / max) * 100, 3)}%` }}
        />
      ))}
      {last && (
        <span className="sr-only">
          最新 {last.date} {formatCostJpy(last.costUsd)}
        </span>
      )}
    </div>
  );
};
