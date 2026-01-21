import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { formatDateTime } from "~/lib/format";
import {
  createInvitation,
  deleteInvitation,
  fetchInvitations,
} from "~/repository/invitation-repository";
import { useAuth } from "../contexts/AuthContext";

export const InvitationsPanel = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { copyToClipboard } = useCopyToClipboard();
  const [email, setEmail] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invitations"],
    queryFn: fetchInvitations,
  });

  const createMutation = useMutation({
    mutationFn: (email: string) => createInvitation(email),
    onSuccess: (data) => {
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/register?token=${data.invitation.token}`;
      setCreatedUrl(url);
      setEmail("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setCreatedUrl(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    createMutation.mutate(email.trim());
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-stone-200 p-4"
      >
        <h3 className="font-medium text-stone-900 mb-4">新規招待を作成</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {createdUrl && (
          <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded">
            <p className="text-sm text-stone-600 mb-2">
              招待URLが作成されました:
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={createdUrl}
                readOnly
                aria-label="招待URL"
                className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded text-sm text-stone-700"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(createdUrl)}
                className="px-3 py-2 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 whitespace-nowrap"
              >
                コピー
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            required
            className="flex-1 px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 whitespace-nowrap"
          >
            {createMutation.isPending ? "作成中..." : "招待を作成"}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="p-4 border-b border-stone-200">
          <h3 className="font-medium text-stone-900">招待一覧</h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-stone-500">読み込み中...</div>
        ) : !data?.invitations.length ? (
          <div className="p-8 text-center text-stone-500">招待はありません</div>
        ) : (
          <>
            {/* Desktop: Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">
                      メール
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">
                      役割
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">
                      状態
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">
                      有効期限
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {data.invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 text-stone-900">{inv.email}</td>
                      <td className="px-4 py-3 text-stone-600">
                        {inv.role === "super_admin"
                          ? "スーパー管理者"
                          : "管理者"}
                      </td>
                      <td className="px-4 py-3">
                        {inv.usedAt ? (
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                            登録済み
                          </span>
                        ) : isExpired(inv.expiresAt) ? (
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-stone-100 text-stone-600 rounded">
                            期限切れ
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                            未使用
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                        {formatDateTime(inv.expiresAt)}
                      </td>
                      <td className="px-4 py-3">
                        {(!inv.usedAt || user?.role === "super_admin") && (
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(inv.id)}
                            disabled={deleteMutation.isPending}
                            className="text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            削除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: Card View */}
            <div className="md:hidden divide-y divide-stone-200">
              {data.invitations.map((inv) => (
                <div key={inv.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm text-stone-900 font-medium break-all">
                      {inv.email}
                    </div>
                    {inv.usedAt ? (
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded shrink-0">
                        登録済み
                      </span>
                    ) : isExpired(inv.expiresAt) ? (
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-stone-100 text-stone-600 rounded shrink-0">
                        期限切れ
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded shrink-0">
                        未使用
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>
                      {inv.role === "super_admin" ? "スーパー管理者" : "管理者"}
                    </span>
                    <span>期限: {formatDateTime(inv.expiresAt)}</span>
                  </div>
                  {(!inv.usedAt || user?.role === "super_admin") && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(inv.id)}
                        disabled={deleteMutation.isPending}
                        className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        削除
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
