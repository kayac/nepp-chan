import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createInvitationRepository } from "./invitation-repository";

const repo = createInvitationRepository(testApiClient);

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("invitation-repository", () => {
  it("fetchInvitations", async () => {
    server.use(
      http.get(`${API}/admin/invitations`, () =>
        HttpResponse.json({ invitations: [] }),
      ),
    );

    const result = await repo.fetchInvitations();
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

    const result = await repo.createInvitation("u", "staff");
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

    await repo.deleteInvitation("i-1");
    expect(called).toBe(true);
  });

  it("失敗系: fetchInvitations 500 は throw", async () => {
    server.use(
      http.get(`${API}/admin/invitations`, () =>
        HttpResponse.json({ error: { message: "boom" } }, { status: 500 }),
      ),
    );

    await expect(repo.fetchInvitations()).rejects.toBeDefined();
  });

  it("失敗系: createInvitation 409 は throw", async () => {
    server.use(
      http.post(`${API}/admin/invitations`, () =>
        HttpResponse.json({ error: { message: "duplicate" } }, { status: 409 }),
      ),
    );

    await expect(repo.createInvitation("u", "staff")).rejects.toBeDefined();
  });

  it("失敗系: deleteInvitation 5xx は throw", async () => {
    server.use(
      http.delete(`${API}/admin/invitations/x`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );

    await expect(repo.deleteInvitation("x")).rejects.toBeDefined();
  });
});
