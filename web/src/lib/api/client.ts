import { createApiClient } from "@nepp-chan/shared/api";
import * as Sentry from "@sentry/react";
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
 * - 既に session token で送っていた場合は再試行しない（fallback 不在）
 * - admin token で送って失敗した場合のみ admin を破棄して fallback 再試行する
 */
const handleUnauthorized = (): boolean => {
  const sessionToken = getSessionToken();
  const currentBearer = getBearerToken();

  // session token しか持っていない場合は admin → anonymous の fallback 経路がない
  if (!currentBearer || (sessionToken && currentBearer === sessionToken)) {
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
  onServerError: (error) => Sentry.captureException(error),
});

export { API_BASE };
export { ApiError, parseErrorResponse } from "@nepp-chan/shared/api";
