import { act, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";

import { AuthProvider, useAuth } from "./AuthContext";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

const Consumer = () => {
  const { user, isAuthenticated, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{user?.username ?? "anon"}</span>
      <span data-testid="auth">{isAuthenticated ? "yes" : "no"}</span>
      <button type="button" onClick={() => void logout()}>
        logout
      </button>
    </div>
  );
};

describe("AuthProvider", () => {
  it("token なしは isAuthenticated=false でユーザーは null", async () => {
    renderWithQuery(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("anon");
      expect(screen.getByTestId("auth").textContent).toBe("no");
    });
  });

  it("token あり + /auth/me 200 で user.username を露出する", async () => {
    setAuthToken("admin-token");
    server.use(
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({
          user: { id: "u-1", username: "alice", name: null, role: "admin" },
        }),
      ),
    );

    renderWithQuery(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("alice");
      expect(screen.getByTestId("auth").textContent).toBe("yes");
    });
  });

  it("logout は postLogout 成功時に localStorage を消す", async () => {
    setAuthToken("admin-token");
    server.use(
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({
          user: { id: "u-1", username: "alice", name: null, role: "admin" },
        }),
      ),
      http.post(`${API}/auth/logout`, () => HttpResponse.json({ ok: true })),
    );

    renderWithQuery(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("alice"),
    );

    await act(async () => {
      screen.getByRole("button", { name: "logout" }).click();
    });

    await waitFor(() => {
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(screen.getByTestId("user").textContent).toBe("anon");
    });
  });

  it("logout は postLogout が失敗してもトークンを消す", async () => {
    setAuthToken("admin-token");
    server.use(
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({
          user: { id: "u-1", username: "bob", name: null, role: "admin" },
        }),
      ),
      http.post(`${API}/auth/logout`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    renderWithQuery(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("bob"),
    );

    await act(async () => {
      screen.getByRole("button", { name: "logout" }).click();
    });

    await waitFor(() => {
      expect(localStorage.getItem("auth_token")).toBeNull();
    });
  });
});
