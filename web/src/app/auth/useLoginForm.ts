import { useState } from "react";

import { login } from "~/lib/api/auth";
import { setAuthToken } from "~/lib/auth-token";
import { redirectTo } from "~/lib/redirect";

export const useLoginForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await login(username, password);
      setAuthToken(result.accessToken);
      redirectTo("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ログイン中にエラーが発生しました",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    username,
    setUsername,
    password,
    setPassword,
    error,
    isLoading,
    handleSubmit,
  };
};
