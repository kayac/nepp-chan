import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button } from "@nepp-chan/shared/ui/Button";
import { type SubmitEvent, useState } from "react";
import {
  useCreateWidgetSite,
  useDeleteWidgetSite,
  useUpdateWidgetSite,
  useWidgetSites,
} from "~/app/dashboard/hooks/useWidgetSites";
import { confirmDialog } from "~/lib/dialog";

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "エラーが発生しました";

export const WidgetSitesPanel = () => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [host, setHost] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useWidgetSites();
  const createMutation = useCreateWidgetSite();
  const updateMutation = useUpdateWidgetSite();
  const deleteMutation = useDeleteWidgetSite();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const resetForm = () => {
    setEditingId(null);
    setHost("");
    setInstructions("");
  };

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!host.trim() || !instructions.trim()) return;
    setError(null);

    const body = { host: host.trim(), instructions: instructions.trim() };
    const handlers = {
      onSuccess: () => resetForm(),
      onError: (err: unknown) => setError(errorMessage(err)),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: body }, handlers);
      return;
    }
    createMutation.mutate(body, handlers);
  };

  const handleDelete = (id: string, host: string) => {
    if (!confirmDialog(`${host} の設定を削除しますか？`)) return;
    setError(null);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        if (editingId === id) resetForm();
      },
      onError: (err) => setError(errorMessage(err)),
    });
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-stone-200 p-4"
      >
        <h3 className="font-medium text-stone-900 mb-2">
          {editingId ? "設置サイトを編集" : "設置サイトを追加"}
        </h3>
        <p className="text-sm text-stone-500 mb-4">
          ここに登録したドメインでウィジェットが開かれたときだけ、ねっぷちゃんに追加の指示が渡ります。
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <label className="block mb-4">
          <span className="block text-sm text-stone-600 mb-1">ドメイン</span>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="www.vill.otoineppu.hokkaido.jp"
            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </label>

        <label className="block mb-4">
          <span className="block text-sm text-stone-600 mb-1">
            このサイト向けの指示
          </span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={6}
            placeholder="設置サイトは音威子府村公式ホームページである"
            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </label>

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={isPending || !host.trim() || !instructions.trim()}
          >
            {editingId ? "更新" : "追加"}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={resetForm}>
              キャンセル
            </Button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-xl border border-stone-200">
        {isLoading && <p className="p-4 text-stone-500">読み込み中...</p>}
        {!isLoading && data?.sites.length === 0 && (
          <p className="p-4 text-stone-500">
            まだ設置サイトが登録されていません。
          </p>
        )}
        <ul className="divide-y divide-stone-200">
          {data?.sites.map((site) => (
            <li key={site.id} className="p-4 flex gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-900 break-all">
                  {site.host}
                </p>
                <p className="mt-1 text-sm text-stone-600 whitespace-pre-wrap">
                  {site.instructions}
                </p>
              </div>
              <div className="flex items-start gap-1">
                <button
                  type="button"
                  aria-label={`${site.host} を編集`}
                  onClick={() => {
                    setEditingId(site.id);
                    setHost(site.host);
                    setInstructions(site.instructions);
                    setError(null);
                  }}
                  className="p-2 text-stone-500 hover:text-teal-700"
                >
                  <PencilSquareIcon className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`${site.host} を削除`}
                  onClick={() => handleDelete(site.id, site.host)}
                  className="p-2 text-stone-500 hover:text-red-700"
                >
                  <TrashIcon className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
