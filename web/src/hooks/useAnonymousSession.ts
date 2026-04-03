import { useEffect, useState } from "react";
import { API_BASE } from "~/lib/api/client";
import { getResourceId } from "~/lib/resource";
import { getSessionToken, setSessionToken } from "~/lib/session-token";

type SessionState = {
  isReady: boolean;
};

const acquireSessionToken = async (
  resourceId: string,
): Promise<{ token: string; resourceId: string }> => {
  const res = await fetch(`${API_BASE}/auth/anonymous-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourceId }),
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

    const resourceId = getResourceId();
    acquireSessionToken(resourceId)
      .then(({ token }) => {
        setSessionToken(token);
        setIsReady(true);
      })
      .catch((error) => {
        console.error("[Session] Failed to acquire session token", error);
        // 409（既に claimed）等でも画面をブロックしない
        setIsReady(true);
      });
  }, [isReady]);

  return { isReady };
};
