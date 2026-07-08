type AnonymousSession = {
  token: string;
  resourceId: string;
};

const SESSION_TOKEN_KEY = "nepp-chan-widget:session-token";
const RESOURCE_ID_KEY = "nepp-chan-widget:resource-id";

const getStoredSession = (): AnonymousSession | null => {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  const resourceId = localStorage.getItem(RESOURCE_ID_KEY);
  if (!token || !resourceId) return null;
  return { token, resourceId };
};

const storeSession = (session: AnonymousSession) => {
  localStorage.setItem(SESSION_TOKEN_KEY, session.token);
  localStorage.setItem(RESOURCE_ID_KEY, session.resourceId);
};

export const acquireAnonymousSession = async (
  apiUrl: string,
): Promise<AnonymousSession> => {
  const stored = getStoredSession();
  if (stored) return stored;

  const res = await fetch(`${apiUrl}/auth/anonymous-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform: "widget" }),
  });
  if (!res.ok) {
    throw new Error(`匿名セッションの取得に失敗しました: ${res.status}`);
  }

  const session = (await res.json()) as AnonymousSession;
  storeSession(session);
  return session;
};
