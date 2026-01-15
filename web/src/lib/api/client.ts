const API_BASE = import.meta.env.VITE_API_URL || "";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  admin?: boolean;
};

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const getHeaders = (admin: boolean): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (admin) {
    const adminKey = import.meta.env.VITE_ADMIN_KEY || "";
    headers["X-Admin-Key"] = adminKey;
  }
  return headers;
};

const parseErrorResponse = async (res: Response, fallback: string) => {
  try {
    const data = await res.json();
    return data.message || fallback;
  } catch {
    return fallback;
  }
};

export const apiClient = async <T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> => {
  const { method = "GET", body, admin = false } = options;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: getHeaders(admin),
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const message = await parseErrorResponse(
      res,
      `リクエストに失敗しました (${res.status})`,
    );
    throw new ApiError(message, res.status);
  }

  return res.json();
};

export { API_BASE, ApiError };
