import { startRegistration } from "@simplewebauthn/browser";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import "~/index.css";
import { fetchRegisterOptions, verifyRegistration } from "~/lib/api/auth";
import { setAuthToken } from "~/lib/auth-token";

const RegisterPage = () => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

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
      const {
        options,
        challengeId,
        email: invitedEmail,
        invitationId,
      } = await fetchRegisterOptions(token);

      setEmail(invitedEmail);

      const regResponse = await startRegistration({ optionsJSON: options });
      const result = await verifyRegistration({
        challengeId,
        response: regResponse,
        invitationId,
      });

      setAuthToken(result.token);
      window.location.href = "/dashboard";
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
    <div className="min-h-dvh flex items-center justify-center bg-stone-50">
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
              href="/login"
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

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <RegisterPage />
  </StrictMode>,
);
