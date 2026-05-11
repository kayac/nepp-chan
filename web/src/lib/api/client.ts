import { createApiClient } from "@nepp-chan/shared/api";
import {
  getBearerToken,
  getSessionToken,
  removeAuthToken,
} from "~/lib/auth-token";
import { queryClient } from "~/lib/query-client";
import { adminUserKeys } from "./keys";

const API_BASE = import.meta.env.PUBLIC_API_URL || "";

/**
 * 401 を受けたら admin token を破棄して anonymous session に切替えて再試行するか判定する。
 * 判定はリクエストが実際に送った Authorization ヘッダ (`sentAuth`) を起点にする。
 * 並行 401 で他のリクエストが先に admin token を破棄済みでも、自分が admin で送っていたなら fallback retry する。
 *
 * - sentAuth が session token と一致する場合: 既に anonymous なので fallback 経路がない → false
 * - それ以外（admin token を送っていた場合）: admin を破棄して fallback retry する → true
 */
const handleUnauthorized = (sentAuth: string): boolean => {
  const sessionToken = getSessionToken();
  if (sessionToken && sentAuth === `Bearer ${sessionToken}`) {
    return false;
  }

  removeAuthToken();
  queryClient.invalidateQueries({ queryKey: adminUserKeys.current });
  return true;
};

export const client = createApiClient({
  baseUrl: API_BASE,
  getAuthToken: getBearerToken,
  onUnauthorized: handleUnauthorized,
  onServerError: (error) => console.error("API server error", error),
});

export { API_BASE };
export { ApiError, parseErrorResponse } from "@nepp-chan/shared/api";
