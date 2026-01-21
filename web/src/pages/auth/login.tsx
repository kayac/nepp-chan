import { startAuthentication } from "@simplewebauthn/browser";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import "~/index.css";
import { fetchLoginOptions, verifyLogin } from "~/lib/api/auth";

const LoginPage = () => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const { options, challengeId } = await fetchLoginOptions();
      const authResponse = await startAuthentication({ optionsJSON: options });
      await verifyLogin({ challengeId, response: authResponse });

      window.location.href = "/dashboard";
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
    <div className="min-h-dvh flex items-center justify-center bg-stone-50">
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
            href="/register"
            className="text-teal-600 hover:text-teal-700 ml-1"
          >
            こちらで登録
          </a>
        </p>
      </div>
    </div>
  );
};

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <LoginPage />
  </StrictMode>,
);
