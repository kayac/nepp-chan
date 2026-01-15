import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";

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

export const fetchRegisterOptions = async (
  token: string,
): Promise<RegisterOptionsResponse> => {
  const res = await fetch(`${API_BASE}/auth/register/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
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
}) => {
  const res = await fetch(`${API_BASE}/auth/register/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
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
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("ログインオプションの取得に失敗しました");
  }

  return res.json();
};

export const verifyLogin = async (params: {
  challengeId: string;
  response: AuthenticationResponseJSON;
}) => {
  const res = await fetch(`${API_BASE}/auth/login/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "認証に失敗しました");
  }

  return res.json();
};

export const fetchCurrentUser = async (): Promise<AdminUser | null> => {
  const res = await fetch(`${API_BASE}/auth/me`, {
    credentials: "include",
  });

  if (!res.ok) {
    return null;
  }

  const data: AuthMeResponse = await res.json();
  return data.user;
};

export const postLogout = async () => {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
};

export type { AdminUser };
