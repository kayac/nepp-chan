import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createSourceCandidateRepository } from "./source-candidate-repository";

const repo = createSourceCandidateRepository(testApiClient);

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("fetchSourceCandidates", () => {
  it("一覧を返す", async () => {
    server.use(
      http.get(`${API}/admin/source-candidates`, () =>
        HttpResponse.json({ candidates: [{ id: "sc-1" }] }),
      ),
    );

    const result = await repo.fetchSourceCandidates();
    expect(result?.candidates[0]?.id).toBe("sc-1");
  });

  it("5xx は throw する", async () => {
    server.use(
      http.get(`${API}/admin/source-candidates`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );

    await expect(repo.fetchSourceCandidates()).rejects.toBeDefined();
  });
});

describe("updateSourceCandidateStatus", () => {
  it("id は path、action は body に送る", async () => {
    server.use(
      http.patch(
        `${API}/admin/source-candidates/sc-1/status`,
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body).toEqual({ action: "approve" });
          return HttpResponse.json({ message: "ok" });
        },
      ),
    );

    const result = await repo.updateSourceCandidateStatus({
      id: "sc-1",
      action: "approve",
    });
    expect(result?.message).toBe("ok");
  });

  it("reset も送れる", async () => {
    server.use(
      http.patch(
        `${API}/admin/source-candidates/sc-1/status`,
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body).toEqual({ action: "reset" });
          return HttpResponse.json({ message: "ok" });
        },
      ),
    );

    await repo.updateSourceCandidateStatus({ id: "sc-1", action: "reset" });
  });

  it("5xx は throw する", async () => {
    server.use(
      http.patch(`${API}/admin/source-candidates/sc-1/status`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );

    await expect(
      repo.updateSourceCandidateStatus({ id: "sc-1", action: "reject" }),
    ).rejects.toBeDefined();
  });
});
