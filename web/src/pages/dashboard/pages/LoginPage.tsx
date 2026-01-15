import { startAuthentication } from "@simplewebauthn/browser";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { API_BASE } from "~/lib/api/client";
import { useAuth } from "../contexts/AuthContext";

export const LoginPage = () => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  const handleLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const optionsRes = await fetch(`${API_BASE}/auth/login/options`, {
        method: "POST",
        credentials: "include",
      });

      if (!optionsRes.ok) {
        throw new Error("ログインオプションの取得に失敗しました");
      }

      const { options, challengeId } = await optionsRes.json();

      const authResponse = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch(`${API_BASE}/auth/login/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          challengeId,
          response: authResponse,
        }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || "認証に失敗しました");
      }

      await checkAuth();
      navigate({ to: "/dashboard" });
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("パスキー認証がキャンセルされました");
        } else {
          setError(err.message);
        }
      } else {
        setError("ログイン中にエラーが発生しました");
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
            <h1 className="text-2xl font-bold text-stone-900">管理画面</h1>
            <p className="text-stone-600 mt-2">パスキーでログイン</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "認証中..." : "パスキーでログイン"}
          </button>

          <div className="mt-6 text-center">
            <a href="/" className="text-teal-600 hover:text-teal-700 text-sm">
              チャットに戻る
            </a>
          </div>
        </div>

        <p className="mt-4 text-center text-stone-500 text-sm">
          招待を受けた方は
          <a
            href="/dashboard/register"
            className="text-teal-600 hover:text-teal-700 ml-1"
          >
            こちらで登録
          </a>
        </p>
      </div>
    </div>
  );
};
