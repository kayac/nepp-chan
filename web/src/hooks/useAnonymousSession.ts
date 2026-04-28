import { useEffect, useRef, useState } from "react";
import { API_BASE } from "~/lib/api/client";
import { getSessionToken, setSessionToken } from "~/lib/auth-token";
import { setResourceId } from "~/lib/resource";

type SessionState = {
  isReady: boolean;
  /** マウント時に session token が未保存だった = この訪問が初回 */
  isFirstVisit: boolean;
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
  const initialHadToken = useRef(
    typeof window !== "undefined" && !!getSessionToken(),
  );
  const [isReady, setIsReady] = useState(initialHadToken.current);

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

  return { isReady, isFirstVisit: !initialHadToken.current };
};
