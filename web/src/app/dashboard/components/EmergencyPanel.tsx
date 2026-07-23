import { useEmergencies } from "~/app/dashboard/hooks/useEmergencies";
import { EmptyStateCard } from "~/components/ui/EmptyStateCard";
import { ErrorBanner, formatError } from "~/components/ui/ErrorBanner";
import { PanelLoading } from "~/components/ui/PanelLoading";
import { formatDateTime } from "~/lib/format";

export const EmergencyPanel = () => {
  const { data, isLoading, error } = useEmergencies();

  if (isLoading) {
    return <PanelLoading />;
  }

  if (error) {
    return <ErrorBanner>{formatError(error)}</ErrorBanner>;
  }

  const emergencies = data?.emergencies ?? [];

  if (emergencies.length === 0) {
    return <EmptyStateCard>緊急情報がありません</EmptyStateCard>;
  }

  return (
    <>
      {/* Desktop: Table View */}
      <div className="hidden md:block bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-stone-600">
                  種別
                </th>
                <th className="px-4 py-3 text-left font-medium text-stone-600">
                  説明
                </th>
                <th className="px-4 py-3 text-left font-medium text-stone-600">
                  場所
                </th>
                <th className="px-4 py-3 text-left font-medium text-stone-600">
                  報告日時
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {emergencies.map((emergency) => (
                <tr key={emergency.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-amber-50 text-amber-700 rounded">
                      {emergency.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-700 max-w-md">
                    {emergency.description}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {emergency.location ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                    {formatDateTime(emergency.reportedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: Card View */}
      <div className="md:hidden space-y-3">
        {emergencies.map((emergency) => (
          <div
            key={emergency.id}
            className="bg-white rounded-xl border border-stone-200 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex px-2 py-1 text-xs font-medium bg-amber-50 text-amber-700 rounded">
                {emergency.type}
              </span>
              <span className="text-xs text-stone-400 whitespace-nowrap">
                {formatDateTime(emergency.reportedAt)}
              </span>
            </div>
            <p className="text-sm text-stone-700">{emergency.description}</p>
            {emergency.location && (
              <div className="text-xs text-stone-500">
                <span className="font-medium">場所:</span> {emergency.location}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
};
