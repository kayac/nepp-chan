import * as Sentry from "@sentry/react";
import createClient from "openapi-fetch";
import { getBearerToken } from "~/lib/auth-token";
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
