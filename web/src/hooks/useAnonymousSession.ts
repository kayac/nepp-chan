import { useEffect, useState } from "react";
import { API_BASE } from "~/lib/api/client";
import { getSessionToken, setSessionToken } from "~/lib/auth-token";
import { setResourceId } from "~/lib/resource";

type SessionState = {
  isReady: boolean;
};

const acquireSessionToken = async (): Promise<{
  token: string;
  resourceId: string;
}> => {
  const res = await fetch(`${API_BASE}/auth/anonymous-session`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to acquire session token: ${res.status}`);
  }
  return res.json();
};

export const useAnonymousSession = (): SessionState => {
  const [isReady, setIsReady] = useState(() => !!getSessionToken());

  useEffect(() => {
    if (isReady) return;

    acquireSessionToken()
      .then(({ token, resourceId }) => {
        setSessionToken(token);
        setResourceId(resourceId);
        setIsReady(true);
      })
      .catch((error) => {
        console.error("[Session] Failed to acquire session token", error);
        setIsReady(true);
      });
  }, [isReady]);

  return { isReady };
};
