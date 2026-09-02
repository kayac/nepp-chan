import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createCorrectionRepository } from "./correction-repository";

const repo = createCorrectionRepository(testApiClient);

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("fetchCorrections", () => {
  it("一覧を返す", async () => {
    server.use(
      http.get(`${API}/admin/corrections`, () =>
        HttpResponse.json({ corrections: [{ id: "c-1" }] }),
      ),
    );

    const result = await repo.fetchCorrections();
    expect(result?.corrections[0]?.id).toBe("c-1");
  });

  it("5xx は throw する", async () => {
    server.use(
      http.get(`${API}/admin/corrections`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );

    await expect(repo.fetchCorrections()).rejects.toBeDefined();
  });
});

describe("createCorrection", () => {
  it("body をそのまま POST する", async () => {
    server.use(
      http.post(`${API}/admin/corrections`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toEqual({
          correctsSourcePath: "knowledge/a.md",
          body: "正しくは〜",
          answerRunId: "run-1",
        });
        return HttpResponse.json({ message: "ok" });
      }),
    );

    const result = await repo.createCorrection({
      correctsSourcePath: "knowledge/a.md",
      body: "正しくは〜",
      answerRunId: "run-1",
    });
    expect(result?.message).toBe("ok");
  });

  it("5xx は throw する", async () => {
    server.use(
      http.post(`${API}/admin/corrections`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );

    await expect(
      repo.createCorrection({ correctsSourcePath: "a.md", body: "x" }),
    ).rejects.toBeDefined();
  });
});

describe("publishCorrection", () => {
  it("path に id を埋め込む", async () => {
    server.use(
      http.post(`${API}/admin/corrections/c-1/publish`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    const result = await repo.publishCorrection("c-1");
    expect(result?.message).toBe("ok");
  });

  it("5xx は throw する", async () => {
    server.use(
      http.post(`${API}/admin/corrections/c-1/publish`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );

    await expect(repo.publishCorrection("c-1")).rejects.toBeDefined();
  });
});

describe("retireCorrection", () => {
  it("path に id を埋め込む", async () => {
    server.use(
      http.post(`${API}/admin/corrections/c-1/retire`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    const result = await repo.retireCorrection("c-1");
    expect(result?.message).toBe("ok");
  });

  it("5xx は throw する", async () => {
    server.use(
      http.post(`${API}/admin/corrections/c-1/retire`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );

    await expect(repo.retireCorrection("c-1")).rejects.toBeDefined();
  });
});

describe("reverifyCorrection", () => {
  it("path に id を埋め込む", async () => {
    server.use(
      http.post(`${API}/admin/corrections/c-1/reverify`, () =>
        HttpResponse.json({ message: "ok" }),
      ),
    );

    const result = await repo.reverifyCorrection("c-1");
    expect(result?.message).toBe("ok");
  });

  it("5xx は throw する", async () => {
    server.use(
      http.post(`${API}/admin/corrections/c-1/reverify`, () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
    );

    await expect(repo.reverifyCorrection("c-1")).rejects.toBeDefined();
  });
});
