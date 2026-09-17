import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_API_BASE as API,
  setTestAuthToken,
  testApiClient,
} from "../../test/api-client";
import { server } from "../../test/msw-server";
import { createTagGroupRepository } from "./tag-group-repository";

const repo = createTagGroupRepository(testApiClient);

beforeEach(() => {
  setTestAuthToken("admin-token");
});

afterEach(() => {
  setTestAuthToken(null);
});

describe("fetchTagGroups", () => {
  it("グループ一覧を返す", async () => {
    server.use(
      http.get(`${API}/admin/tag-groups`, () =>
        HttpResponse.json({
          groups: [],
          unassigned: [{ tag: "新語", count: 2, example: null }],
          recent: [],
        }),
      ),
    );

    const result = await repo.fetchTagGroups();
    expect(result.unassigned).toEqual([
      { tag: "新語", count: 2, example: null },
    ]);
  });

  it("エラーは throw する", async () => {
    server.use(
      http.get(`${API}/admin/tag-groups`, () =>
        HttpResponse.json(
          { error: { code: 403, message: "forbidden" } },
          { status: 403 },
        ),
      ),
    );

    await expect(repo.fetchTagGroups()).rejects.toBeDefined();
  });
});

describe("createTagGroup", () => {
  it("名前・種別・軸を body で送る", async () => {
    server.use(
      http.post(`${API}/admin/tag-groups`, async ({ request }) => {
        expect(await request.json()).toEqual({
          name: "農家",
          kind: "attribute",
          axis: "立場",
        });
        return HttpResponse.json(
          {
            id: "g-1",
            name: "農家",
            kind: "attribute",
            axis: "立場",
            sortOrder: 360,
          },
          { status: 201 },
        );
      }),
    );

    const result = await repo.createTagGroup({
      name: "農家",
      kind: "attribute",
      axis: "立場",
    });
    expect(result.id).toBe("g-1");
  });

  it("エラーは throw する", async () => {
    server.use(
      http.post(`${API}/admin/tag-groups`, () =>
        HttpResponse.json(
          { error: { code: 400, message: "bad" } },
          { status: 400 },
        ),
      ),
    );

    await expect(
      repo.createTagGroup({ name: "", kind: "attribute", axis: null }),
    ).rejects.toBeDefined();
  });
});

describe("setTagAlias", () => {
  it("タグをパスに、groupId を body で送る", async () => {
    server.use(
      http.put(
        `${API}/admin/tag-groups/aliases/:tag`,
        async ({ params, request }) => {
          expect(params.tag).toBe("旅行者");
          expect(await request.json()).toEqual({ groupId: "tourist" });
          return HttpResponse.json({ tag: "旅行者", groupId: "tourist" });
        },
      ),
    );

    const result = await repo.setTagAlias("旅行者", "tourist");
    expect(result.groupId).toBe("tourist");
  });

  it("エラーは throw する", async () => {
    server.use(
      http.put(`${API}/admin/tag-groups/aliases/:tag`, () =>
        HttpResponse.json(
          { error: { code: 404, message: "no group" } },
          { status: 404 },
        ),
      ),
    );

    await expect(repo.setTagAlias("x", "nope")).rejects.toBeDefined();
  });
});

describe("assignTagGroups", () => {
  it("振り分け結果を返す", async () => {
    server.use(
      http.post(`${API}/admin/tag-groups/assign`, () =>
        HttpResponse.json({ assigned: 3, unassigned: 1, remaining: 0 }),
      ),
    );

    expect(await repo.assignTagGroups()).toEqual({
      assigned: 3,
      unassigned: 1,
      remaining: 0,
    });
  });

  it("エラーは throw する", async () => {
    server.use(
      http.post(`${API}/admin/tag-groups/assign`, () =>
        HttpResponse.json(
          { error: { code: 500, message: "llm" } },
          { status: 500 },
        ),
      ),
    );

    await expect(repo.assignTagGroups()).rejects.toBeDefined();
  });
});
