import { cn } from "@nepp-chan/shared/lib/class-merge";
import { ToolLoadingState } from "@nepp-chan/shared/ui/Loading";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TableIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { ToolPartComponent } from "~/components/chat/types";

type DataTableArgs = {
  title?: string;
  columns: { key: string; label: string; sortable?: boolean }[];
  data: Record<string, unknown>[];
};

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
} | null;

const DataTable = ({ args }: { args: DataTableArgs }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [isExpanded, setIsExpanded] = useState(args.data.length <= 5);

  const sortedData = useMemo(() => {
    if (!sortConfig) return args.data;

    return [...args.data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [args.data, sortConfig]);

  const displayedData = isExpanded ? sortedData : sortedData.slice(0, 5);

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current?.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-(--border-1) bg-(--bg-raised)">
      {args.title && (
        <div className="flex items-center gap-2 border-b border-(--border-1) px-4 py-3">
          <TableIcon className="size-5 text-(--fg-3)" />
          <h3 className="font-medium text-(--fg-2)">{args.title}</h3>
          <span className="ml-auto text-sm text-(--fg-4)">
            {args.data.length}件
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-(--bg-sunken)">
            <tr className="border-b border-(--border-1)">
              {args.columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold text-(--fg-2)",
                    col.sortable &&
                      "cursor-pointer select-none hover:bg-(--bg-sunken)",
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable &&
                      sortConfig?.key === col.key &&
                      (sortConfig.direction === "asc" ? (
                        <ArrowUpIcon className="size-3" />
                      ) : (
                        <ArrowDownIcon className="size-3" />
                      ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-(--border-1)">
            {displayedData.map((row) => (
              <tr
                key={JSON.stringify(row)}
                className="transition-colors hover:bg-(--bg-sunken)"
              >
                {args.columns.map((col) => (
                  <td
                    key={col.key}
                    className="whitespace-nowrap px-4 py-3 text-sm text-(--fg-2)"
                  >
                    {String(row[col.key] ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {args.data.length > 5 && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-center gap-1 border-t border-(--border-1) py-2 text-sm text-(--fg-3) hover:bg-(--bg-sunken)"
        >
          {isExpanded ? (
            <>
              <ChevronUpIcon className="size-4" />
              折りたたむ
            </>
          ) : (
            <>
              <ChevronDownIcon className="size-4" />
              すべて表示（{args.data.length}件）
            </>
          )}
        </button>
      )}
    </div>
  );
};

const renderDataTable = (args: DataTableArgs, isRunning: boolean) => {
  if ((isRunning && !args.columns) || !args.columns || !args.data) {
    return (
      <div className="my-4">
        <ToolLoadingState
          variant="table"
          icon={<TableIcon className="size-5 animate-pulse text-(--fg-4)" />}
        />
      </div>
    );
  }

  return (
    <div className="my-4">
      <DataTable args={args} />
    </div>
  );
};

/**
 * MessagePrimitive.Parts の tools.by_name で使用するコンポーネント
 */
export const DisplayTableToolComponent: ToolPartComponent = ({
  args,
  status,
}) =>
  renderDataTable(args as unknown as DataTableArgs, status?.type === "running");
