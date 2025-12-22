import { usePersonas } from "~/hooks/useDashboard";

export const PersonaPanel = () => {
  const { data, isLoading, error } = usePersonas();

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

  const personas = data?.personas ?? [];

  if (personas.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-stone-500">
        ペルソナデータがありません
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
                カテゴリ
              </th>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                内容
              </th>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                作成日時
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {personas.map((persona) => (
              <tr key={persona.id} className="hover:bg-stone-50">
                <td className="px-4 py-3">
                  <span className="inline-flex px-2 py-1 text-xs font-medium bg-teal-50 text-teal-700 rounded">
                    {persona.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-700 max-w-md truncate">
                  {persona.content}
                </td>
                <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                  {new Date(persona.createdAt).toLocaleString("ja-JP")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
