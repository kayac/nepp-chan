import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { fetchCurrentUser, login, postLogout, register } from "./auth";

const API_BASE = "http://localhost:8787"; // PUBLIC_API_URL は test 環境では空文字

const adminUser = {
  id: "u-1",
  username: "admin01",
  name: "管理者",
  role: "admin",
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("register", () => {
  it("正常系: accessToken と user を返す", async () => {
    server.use(
      http.post(`${API_BASE}/auth/register`, async ({ request }) => {
        const body = (await request.json()) as Record<string, string>;
        expect(body.token).toBe("inv");
        expect(body.password).toBe("pw12345678");
        return HttpResponse.json({
          accessToken: "tok",
          user: adminUser,
        });
      }),
    );

    const result = await register("inv", "pw12345678");
    expect(result.accessToken).toBe("tok");
    expect(result.user.username).toBe("admin01");
  });

  it("400 エラーは error.message を throw", async () => {
    server.use(
      http.post(`${API_BASE}/auth/register`, () =>
        HttpResponse.json(
          { error: { message: "招待が無効です" } },
          { status: 400 },
        ),
      ),
    );

    await expect(register("inv", "pw")).rejects.toThrow("招待が無効です");
  });
});

describe("login", () => {
  it("正常系", async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json({ accessToken: "tok", user: adminUser }),
      ),
    );

    const result = await login("u", "p");
    expect(result.accessToken).toBe("tok");
  });

  it("401 は error.message を throw", async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json({ error: { message: "認証失敗" } }, { status: 401 }),
      ),
    );

    await expect(login("u", "wrong")).rejects.toThrow("認証失敗");
  });
});

describe("fetchCurrentUser", () => {
  it("auth token が無ければ即 null（API を呼ばない）", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await fetchCurrentUser();

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("有効トークンでユーザー情報を返す", async () => {
    setAuthToken("admin-token");
    server.use(
      http.get(`${API_BASE}/auth/me`, ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer admin-token");
        return HttpResponse.json({ user: adminUser });
      }),
    );

    const result = await fetchCurrentUser();
    expect(result?.username).toBe("admin01");
  });

  it("401 が返ったら auth token を破棄して null", async () => {
    setAuthToken("expired");
    server.use(
      http.get(`${API_BASE}/auth/me`, () =>
        HttpResponse.json({ message: "expired" }, { status: 401 }),
      ),
    );

    const result = await fetchCurrentUser();
    expect(result).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("user: null でも null を返す", async () => {
    setAuthToken("token");
    server.use(
      http.get(`${API_BASE}/auth/me`, () => HttpResponse.json({ user: null })),
    );

    const result = await fetchCurrentUser();
    expect(result).toBeNull();
  });
});

describe("postLogout", () => {
  it("token が無ければ何もしない", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await postLogout();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("token があれば logout エンドポイントを叩く", async () => {
    setAuthToken("tok");
    let called = false;
    server.use(
      http.post(`${API_BASE}/auth/logout`, () => {
        called = true;
        return HttpResponse.json({ message: "ok" });
      }),
    );

    await postLogout();
    expect(called).toBe(true);
  });

  it("API 失敗でも throw しない（fire-and-forget）", async () => {
    setAuthToken("tok");
    server.use(
      http.post(`${API_BASE}/auth/logout`, () => HttpResponse.error()),
    );

    await expect(postLogout()).resolves.toBeUndefined();
  });
});
