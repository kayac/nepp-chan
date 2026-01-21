import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";

import { getAuthToken } from "~/lib/auth-token";
import { API_BASE } from "./client";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

type RegisterOptionsResponse = {
  options: PublicKeyCredentialCreationOptionsJSON;
  challengeId: string;
  email: string;
  invitationId: string;
};

type LoginOptionsResponse = {
  options: PublicKeyCredentialRequestOptionsJSON;
  challengeId: string;
};

type AuthMeResponse = {
  user: AdminUser | null;
};

type AuthVerifyResponse = {
  success: boolean;
  token: string;
  user: AdminUser;
};

export const fetchRegisterOptions = async (
  token: string,
): Promise<RegisterOptionsResponse> => {
  const res = await fetch(`${API_BASE}/auth/register/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "登録オプションの取得に失敗しました");
  }

  return res.json();
};

export const verifyRegistration = async (params: {
  challengeId: string;
  response: RegistrationResponseJSON;
  invitationId: string;
}): Promise<AuthVerifyResponse> => {
  const res = await fetch(`${API_BASE}/auth/register/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "登録に失敗しました");
  }

  return res.json();
};

export const fetchLoginOptions = async (): Promise<LoginOptionsResponse> => {
  const res = await fetch(`${API_BASE}/auth/login/options`, {
    method: "POST",
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "ログインオプションの取得に失敗しました");
  }

  return res.json();
};

export const verifyLogin = async (params: {
  challengeId: string;
  response: AuthenticationResponseJSON;
}): Promise<AuthVerifyResponse> => {
  const res = await fetch(`${API_BASE}/auth/login/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "認証に失敗しました");
  }

  return res.json();
};

export const fetchCurrentUser = async (): Promise<AdminUser | null> => {
  const token = getAuthToken();
  if (!token) {
    return null;
  }

  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status !== 401) {
      console.error(`認証情報取得エラー: ${res.status} ${res.statusText}`);
    }
    return null;
  }

  const data: AuthMeResponse = await res.json();
  return data.user;
};

export const postLogout = async () => {
  const token = getAuthToken();
  if (!token) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      console.error(`ログアウトエラー: ${res.status} ${res.statusText}`);
    }
  } catch (error) {
    console.error("ログアウト失敗:", error);
  }
};

export type { AdminUser };
