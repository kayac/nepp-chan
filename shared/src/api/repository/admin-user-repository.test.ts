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
});
