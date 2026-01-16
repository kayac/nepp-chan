import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { API_BASE } from "~/lib/api/client";
import { useAuth } from "../contexts/AuthContext";

type Invitation = {
  id: string;
  email: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

const fetchInvitations = async (): Promise<{ invitations: Invitation[] }> => {
  const res = await fetch(`${API_BASE}/admin/invitations`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("招待一覧の取得に失敗しました");
  return res.json();
};

const createInvitation = async (
  email: string,
): Promise<{ success: boolean; invitation: { token: string } }> => {
  const res = await fetch(`${API_BASE}/admin/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "招待の作成に失敗しました");
  }
  return res.json();
};

const deleteInvitation = async (id: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/admin/invitations/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("招待の削除に失敗しました");
};

export const InvitationsPanel = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
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

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg p-4 shadow-sm"
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
            <div className="flex gap-2">
              <input
                type="text"
                value={createdUrl}
                readOnly
                aria-label="招待URL"
                className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded text-sm"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(createdUrl)}
                className="px-3 py-2 bg-teal-600 text-white rounded text-sm hover:bg-teal-700"
              >
                コピー
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-4">
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
            className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
          >
            {createMutation.isPending ? "作成中..." : "招待を作成"}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-200">
          <h3 className="font-medium text-stone-900">招待一覧</h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-stone-500">読み込み中...</div>
        ) : !data?.invitations.length ? (
          <div className="p-8 text-center text-stone-500">招待はありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">
                    メール
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">
                    役割
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">
                    状態
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">
                    有効期限
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {data.invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-sm text-stone-900">
                      {inv.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-600">
                      {inv.role === "super_admin" ? "スーパー管理者" : "管理者"}
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
                    <td className="px-4 py-3 text-sm text-stone-600">
                      {formatDate(inv.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      {(!inv.usedAt || user?.role === "super_admin") && (
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(inv.id)}
                          disabled={deleteMutation.isPending}
                          className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
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
        )}
      </div>
    </div>
  );
};
