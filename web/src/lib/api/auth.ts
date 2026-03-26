import { getAuthToken } from "~/lib/auth-token";
import type { paths } from "~/types/api";
import { API_BASE, parseErrorResponse } from "./client";

type AdminUser = NonNullable<
  paths["/auth/me"]["get"]["responses"]["200"]["content"]["application/json"]["user"]
>;

type AuthResponse = {
  accessToken: string;
  user: AdminUser;
};

type AuthMeResponse = {
  user: AdminUser | null;
};

const postAuthRequest = async (
  path: string,
  body: Record<string, string>,
  fallbackMessage: string,
): Promise<AuthResponse> => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new Error(message || fallbackMessage);
  }

  return res.json();
};

export const register = (
  token: string,
  password: string,
): Promise<AuthResponse> =>
  postAuthRequest("/auth/register", { token, password }, "登録に失敗しました");

export const login = (
  username: string,
  password: string,
): Promise<AuthResponse> =>
  postAuthRequest(
    "/auth/login",
    { username, password },
    "ログインに失敗しました",
  );

export const fetchCurrentUser = async (): Promise<AdminUser | null> => {
  const token = getAuthToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) return null;

  const data: AuthMeResponse = await res.json();
  return data.user;
};

export const postLogout = async () => {
  const token = getAuthToken();
  if (!token) return;

  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    console.error("ログアウト失敗:", error);
  }
};

export type { AdminUser };
