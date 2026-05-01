import * as Sentry from "@sentry/react";
import createClient from "openapi-fetch";
import {
  getAuthToken,
  getBearerToken,
  removeAuthToken,
} from "~/lib/auth-token";
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

const adminTokenRequests = new Map<string, Request>();

client.use({
  async onRequest({ request, id }) {
    const adminToken = getAuthToken();
    const token = getBearerToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    if (adminToken && token === adminToken) {
      adminTokenRequests.set(id, request.clone());
    }
    return request;
  },
});

client.use({
  async onResponse({ response, id }) {
    const adminTokenRequest = adminTokenRequests.get(id);
    adminTokenRequests.delete(id);

    if (response.status === 401 && adminTokenRequest) {
      removeAuthToken();
      const retryHeaders = new Headers(adminTokenRequest.headers);
      retryHeaders.delete("Authorization");
      const fallbackToken = getBearerToken();
      if (fallbackToken) {
        retryHeaders.set("Authorization", `Bearer ${fallbackToken}`);
      }
      const retryResponse = await fetch(adminTokenRequest.url, {
        method: adminTokenRequest.method,
        headers: retryHeaders,
        body: adminTokenRequest.body,
        credentials: adminTokenRequest.credentials,
        // @ts-expect-error duplex is required when streaming a body
        duplex: adminTokenRequest.body ? "half" : undefined,
      });
      if (!retryResponse.ok) {
        const message = await parseErrorResponse(retryResponse);
        if (retryResponse.status >= 500) {
          Sentry.captureException(new ApiError(message, retryResponse.status));
        }
        throw new ApiError(message, retryResponse.status);
      }
      return retryResponse;
    }

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
