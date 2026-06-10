import { act, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useCreateInvitation,
  useDeleteAdminUser,
  useDeleteInvitation,
  useInvitations,
} from "./useInvitations";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("useInvitations", () => {
  it("invitations を取得", async () => {
    server.use(
      http.get(`${API}/admin/invitations`, () =>
        HttpResponse.json({
          invitations: [
            {
              id: "i-1",
              username: "alice",
              role: "staff",
              token: "tok",
              expiresAt: "2030-12-31T00:00:00Z",
              usedAt: null,
              createdAt: "2030-01-01T00:00:00Z",
            },
          ],
        }),
      ),
    );
    const { result } = renderHookWithQuery(() => useInvitations());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.invitations).toHaveLength(1);
  });
});

describe("useCreateInvitation", () => {
  it("成功で invitation を返す", async () => {
    server.use(
      http.post(`${API}/admin/invitations`, () =>
        HttpResponse.json(
          {
            invitation: {
              id: "i-2",
              username: "bob",
              role: "admin",
              token: "tok2",
              expiresAt: "2030-12-31T00:00:00Z",
              usedAt: null,
              createdAt: "2030-01-01T00:00:00Z",
            },
          },
          { status: 201 },
        ),
      ),
    );

    const { result } = renderHookWithQuery(() => useCreateInvitation());
    let returned:
      | Awaited<ReturnType<typeof result.current.mutateAsync>>
      | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        username: "bob",
        role: "admin",
      });
    });

    expect(returned?.invitation.token).toBe("tok2");
  });
});

describe("useDeleteInvitation", () => {
  it("成功で isSuccess", async () => {
    server.use(
      http.delete(`${API}/admin/invitations/i-1`, () =>
        HttpResponse.json({ message: "deleted" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useDeleteInvitation());
    await act(async () => {
      await result.current.mutateAsync("i-1");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useDeleteAdminUser", () => {
  it("成功で isSuccess", async () => {
    server.use(
      http.delete(`${API}/admin/users/u-1`, () =>
        HttpResponse.json({ message: "deleted" }),
      ),
    );

    const { result } = renderHookWithQuery(() => useDeleteAdminUser());
    await act(async () => {
      await result.current.mutateAsync("u-1");
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("4xx で isError", async () => {
    server.use(
      http.delete(`${API}/admin/users/u-self`, () =>
        HttpResponse.json(
          { error: { message: "自分自身は削除できません" } },
          { status: 400 },
        ),
      ),
    );

    const { result } = renderHookWithQuery(() => useDeleteAdminUser());
    await act(async () => {
      await result.current.mutateAsync("u-self").catch(() => {});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
