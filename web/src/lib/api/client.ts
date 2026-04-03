import * as Sentry from "@sentry/react";
import createClient from "openapi-fetch";
import { getAuthToken } from "~/lib/auth-token";
import { getSessionToken } from "~/lib/session-token";
import type { paths } from "~/types/api";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_BASE = import.meta.env.PUBLIC_API_URL || "";

export const client = createClient<paths>({ baseUrl: API_BASE });

client.use({
  async onRequest({ request }) {
    const authToken = getAuthToken();
    if (authToken) {
      request.headers.set("Authorization", `Bearer ${authToken}`);
    }

    const sessionToken = getSessionToken();
    if (sessionToken) {
      request.headers.set("X-Session-Token", sessionToken);
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
