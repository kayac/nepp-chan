import { useEmergencies } from "~/hooks/useDashboard";
import { formatDateTime } from "~/lib/format";

export const EmergencyPanel = () => {
  const { data, isLoading, error } = useEmergencies();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-stone-500">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
        エラー: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  const emergencies = data?.emergencies ?? [];

  if (emergencies.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-stone-500">
        緊急情報がありません
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
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
                <td className="px-4 py-3 text-stone-700 max-w-md truncate">
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
  );
};
