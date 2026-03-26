import { useEffect, useState } from "react";
import { RootLayout } from "~/components/RootLayout";
import { register } from "~/lib/api/auth";
import { setAuthToken } from "~/lib/auth-token";

export const RegisterPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  useEffect(() => {
    if (!token) {
      setError("招待トークンがありません");
    }
  }, [token]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await register(token, password);
      setAuthToken(result.accessToken);
      window.location.href = "/dashboard";
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("登録中にエラーが発生しました");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <RootLayout>
      <div className="min-h-dvh flex items-center justify-center bg-stone-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-stone-900">管理者登録</h1>
              <p className="text-stone-600 mt-2">
                パスワードを設定してください
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {token ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-stone-700 mb-1"
                  >
                    パスワード
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-stone-500">8文字以上</p>
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-sm font-medium text-stone-700 mb-1"
                  >
                    パスワード（確認）
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "登録中..." : "登録する"}
                </button>
              </form>
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
    </RootLayout>
  );
};
