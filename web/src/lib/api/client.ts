import * as Sentry from "@sentry/react";
import createClient from "openapi-fetch";
import {
  getBearerToken,
  getSessionToken,
  removeAuthToken,
} from "~/lib/auth-token";
import { queryClient } from "~/lib/query-client";
import type { paths } from "~/types/api";
import { adminUserKeys } from "./keys";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_BASE = import.meta.env.PUBLIC_API_URL || "";

// 401 が返って admin token が原因と判定できれば、token を破棄してフォールバックで再試行する。
// session token は不変なので、「送ったヘッダが session token と一致しない」を起点に判定する。
// admin token は破棄後も並行リクエストで判定がぶれないよう、現在値ではなく送信ヘッダ側を見る。
const fetchWithAuthRetry = async (request: Request): Promise<Response> => {
  const retryRequest = request.clone();
  const response = await fetch(request);
  if (response.status !== 401) return response;

  const sentAuth = retryRequest.headers.get("Authorization");
  if (!sentAuth) return response;
  const sessionToken = getSessionToken();
  if (sessionToken && sentAuth === `Bearer ${sessionToken}`) return response;

  removeAuthToken();
  queryClient.invalidateQueries({ queryKey: adminUserKeys.current });
  const headers = new Headers(retryRequest.headers);
  const fallbackToken = getBearerToken();
  if (fallbackToken) {
    headers.set("Authorization", `Bearer ${fallbackToken}`);
  } else {
    headers.delete("Authorization");
  }
  return fetch(new Request(retryRequest, { headers }));
};

export const client = createClient<paths>({
  baseUrl: API_BASE,
  fetch: fetchWithAuthRetry,
});

client.use({
  async onRequest({ request }) {
    const token = getBearerToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
});

client.use({
  async onResponse({ response }) {
    if (!response.ok) {
      const message = await parseErrorResponse(response);
      if (response.status >= 500) {
        Sentry.captureException(new ApiError(message, response.status));
      }
      throw new ApiError(message, response.status);
    }
    return response;
  },
});

export const parseErrorResponse = async (res: Response) => {
  try {
    const data = await res.json();
    return (
      data.error?.message ||
      data.message ||
      `リクエストに失敗しました (${res.status})`
    );
  } catch {
    return `リクエストに失敗しました (${res.status})`;
  }
};

export { API_BASE, ApiError };
