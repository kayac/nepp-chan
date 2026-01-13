import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TableIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "~/lib/class-merge";

type DataTableArgs = {
  title?: string;
  columns: { key: string; label: string; sortable?: boolean }[];
  data: Record<string, unknown>[];
};

type DataTableResult = {
  displayed: boolean;
};

const LoadingState = () => (
  <div className="rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 p-4">
    <div className="flex items-center gap-2">
      <TableIcon className="size-5 animate-pulse text-slate-400" />
      <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
    </div>
    <div className="mt-3 space-y-2">
      <div className="h-8 animate-pulse rounded bg-slate-200" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
      ))}
    </div>
  </div>
);

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
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      {args.title && (
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <TableIcon className="size-5 text-slate-500" />
          <h3 className="font-medium text-slate-700">{args.title}</h3>
          <span className="ml-auto text-sm text-slate-400">
            {args.data.length}件
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {args.columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500",
                    col.sortable &&
                      "cursor-pointer select-none hover:bg-slate-100",
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
          <tbody className="divide-y divide-slate-100">
            {displayedData.map((row) => (
              <tr
                key={JSON.stringify(row)}
                className="transition-colors hover:bg-slate-50"
              >
                {args.columns.map((col) => (
                  <td
                    key={col.key}
                    className="whitespace-nowrap px-4 py-3 text-sm text-slate-700"
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
          className="flex w-full items-center justify-center gap-1 border-t border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50"
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

/**
 * MessagePrimitive.Parts の tools.by_name で使用するコンポーネント
 */
export const DisplayTableToolComponent: ToolCallMessagePartComponent = ({
  args,
  status,
}) => {
  const tableArgs = args as unknown as DataTableArgs;

  if (status?.type === "running" && !tableArgs.columns) {
    return (
      <div className="my-4">
        <LoadingState />
      </div>
    );
  }

  if (!tableArgs.columns || !tableArgs.data) {
    return (
      <div className="my-4">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="my-4">
      <DataTable args={tableArgs} />
    </div>
  );
};

export const DataTableToolUI = makeAssistantToolUI<
  DataTableArgs,
  DataTableResult
>({
  toolName: "displayTableTool",
  render: ({ args, status }) => {
    if (status.type === "running" && !args.columns) {
      return (
        <div className="my-4">
          <LoadingState />
        </div>
      );
    }

    if (!args.columns || !args.data) {
      return (
        <div className="my-4">
          <LoadingState />
        </div>
      );
    }

    return (
      <div className="my-4">
        <DataTable args={args} />
      </div>
    );
  },
});
