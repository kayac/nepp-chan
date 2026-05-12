import { useEffect, useState } from "react";

import { register } from "~/lib/api/auth";
import { setAuthToken } from "~/lib/auth-token";
import { getCurrentSearchParams, redirectTo } from "~/lib/redirect";
import { validatePassword } from "./helpers";

export const useRegisterForm = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const token = getCurrentSearchParams().get("token");

  useEffect(() => {
    if (!token) {
      setError("招待トークンがありません");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const validation = validatePassword(password, confirmPassword);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await register(token, password);
      setAuthToken(result.accessToken);
      redirectTo("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "登録中にエラーが発生しました",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    token,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    isLoading,
    handleSubmit,
  };
};
