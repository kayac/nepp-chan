import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createAdminUserRepository } from "./admin-user-repository";

const repo = createAdminUserRepository(testApiClient);

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("admin-user-repository", () => {
  it("deleteAdminUser: DELETE", async () => {
    let called = false;
    server.use(
      http.delete(`${API}/admin/users/u-1`, () => {
        called = true;
        return HttpResponse.json({ message: "ok" });
      }),
    );

    await repo.deleteAdminUser("u-1");
    expect(called).toBe(true);
  });

  it("失敗系: deleteAdminUser 4xx は throw", async () => {
    server.use(
      http.delete(`${API}/admin/users/u-self`, () =>
        HttpResponse.json(
          { error: { message: "自分自身は削除できません" } },
          { status: 400 },
        ),
      ),
    );

    await expect(repo.deleteAdminUser("u-self")).rejects.toBeDefined();
  });
});
