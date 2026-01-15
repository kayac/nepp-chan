import { startRegistration } from "@simplewebauthn/browser";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { API_BASE } from "~/lib/api/client";
import { useAuth } from "../contexts/AuthContext";

export const RegisterPage = () => {
  const { token } = useSearch({ from: "/dashboard/register" });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  useEffect(() => {
    if (!token) {
      setError("招待トークンがありません");
    }
  }, [token]);

  const handleRegister = async () => {
    if (!token) return;

    setError(null);
    setIsLoading(true);

    try {
      const optionsRes = await fetch(`${API_BASE}/auth/register/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });

      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        throw new Error(data.error || "登録オプションの取得に失敗しました");
      }

      const {
        options,
        challengeId,
        email: invitedEmail,
        invitationId,
      } = await optionsRes.json();

      setEmail(invitedEmail);

      const regResponse = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch(`${API_BASE}/auth/register/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          challengeId,
          response: regResponse,
          invitationId,
        }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || "登録に失敗しました");
      }

      await checkAuth();
      navigate({ to: "/dashboard" });
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("パスキー登録がキャンセルされました");
        } else if (err.name === "InvalidStateError") {
          setError("このデバイスには既にパスキーが登録されています");
        } else {
          setError(err.message);
        }
      } else {
        setError("登録中にエラーが発生しました");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-stone-900">管理者登録</h1>
            <p className="text-stone-600 mt-2">パスキーを登録してください</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {email && (
            <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <p className="text-sm text-stone-600">登録メールアドレス</p>
              <p className="font-medium text-stone-900">{email}</p>
            </div>
          )}

          {token ? (
            <button
              type="button"
              onClick={handleRegister}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "登録中..." : "パスキーを登録"}
            </button>
          ) : (
            <div className="text-center text-stone-500">
              <p>有効な招待リンクが必要です</p>
            </div>
          )}

          <div className="mt-6 text-center">
            <a
              href="/dashboard/login"
              className="text-teal-600 hover:text-teal-700 text-sm"
            >
              既にアカウントをお持ちの方はログイン
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
