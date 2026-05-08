import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "../lib/auth-token";
import { server } from "../test/msw-server";
import {
  createInvitation,
  deleteInvitation,
  fetchInvitations,
} from "./invitation-repository";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("invitation-repository", () => {
  it("fetchInvitations", async () => {
    server.use(
      http.get(`${API}/admin/invitations`, () =>
        HttpResponse.json({ invitations: [] }),
      ),
    );

    const result = await fetchInvitations();
    expect(result?.invitations).toEqual([]);
  });

  it("createInvitation: username + role を送る", async () => {
    server.use(
      http.post(`${API}/admin/invitations`, async ({ request }) => {
        const body = (await request.json()) as {
          username: string;
          role: string;
        };
        expect(body.username).toBe("u");
        expect(body.role).toBe("staff");
        return HttpResponse.json({
          invitation: {
            id: "i-1",
            username: "u",
            token: "tok",
            expiresAt: "2025-12-31T00:00:00Z",
          },
        });
      }),
    );

    const result = await createInvitation("u", "staff");
    expect(result?.invitation.token).toBe("tok");
  });

  it("deleteInvitation: DELETE", async () => {
    let called = false;
    server.use(
      http.delete(`${API}/admin/invitations/i-1`, () => {
        called = true;
        return HttpResponse.json({ message: "ok" });
      }),
    );

    await deleteInvitation("i-1");
    expect(called).toBe(true);
  });
});
