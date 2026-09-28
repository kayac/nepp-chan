import { formatCostJpy } from "./helpers";

interface Props {
  title: string;
  segments: { key: string; label: string; color: string; costUsd: number }[];
}

export const CostBreakdownBar = ({ title, segments }: Props) => {
  const total = segments.reduce((sum, s) => sum + s.costUsd, 0);
  if (total === 0) return null;

  return (
    <div>
      <p className="text-xs text-(--fg-3) mb-1.5">{title}</p>
      <div
        data-testid="cost-breakdown-segments"
        className="flex h-7 rounded-md overflow-hidden bg-(--bg-sunken)"
      >
        {segments.map((segment) => (
          <div
            key={segment.key}
            style={{
              width: `${(segment.costUsd / total) * 100}%`,
              background: segment.color,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-(--fg-2)">
        {segments.map((segment) => (
          <span key={segment.key} className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: segment.color }}
            />
            {segment.label}
            <b className="font-medium tabular-nums text-(--fg-1)">
              {formatCostJpy(segment.costUsd)}
            </b>
          </span>
        ))}
      </div>
    </div>
  );
};
