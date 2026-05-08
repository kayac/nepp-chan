import { createApiClient } from "../api";

export const TEST_API_BASE = "http://localhost:8787";

let currentToken: string | null = null;

export const setTestAuthToken = (token: string | null) => {
  currentToken = token;
};

export const testApiClient = createApiClient({
  baseUrl: TEST_API_BASE,
  getAuthToken: () => currentToken,
});
