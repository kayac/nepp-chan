import { useEffect, useRef, useState } from "react";
import { API_BASE } from "~/lib/api/client";
import {
  getSessionToken,
  removeSessionToken,
  setSessionToken,
} from "~/lib/auth-token";
import { setResourceId } from "~/lib/resource";

type SessionState = {
  isReady: boolean;
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

const isSessionTokenActive = (token: string) => {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const { exp } = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof exp === "number" && exp > Date.now() / 1000;
  } catch {
    return false;
  }
};

export const useAnonymousSession = (): SessionState => {
  const initialToken = useRef(
    typeof window !== "undefined" ? getSessionToken() : null,
  );
  const initialHadActiveToken = useRef(
    !!initialToken.current && isSessionTokenActive(initialToken.current),
  );
  const [isReady, setIsReady] = useState(initialHadActiveToken.current);

  useEffect(() => {
    if (isReady) return;

    if (initialToken.current) {
      removeSessionToken();
    }

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

  return { isReady, isFirstVisit: !initialHadActiveToken.current };
};
