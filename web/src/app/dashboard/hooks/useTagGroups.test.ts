import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderHookWithQuery } from "~/test/query";
import {
  useAssignTagGroups,
  useCreateTagGroup,
  useSetTagAlias,
  useTagGroups,
} from "./useTagGroups";

const API = "http://localhost:8787";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("useTagGroups", () => {
  it("グループ一覧を取得する", async () => {
    server.use(
      http.get(`${API}/admin/tag-groups`, () =>
        HttpResponse.json({
          groups: [],
          unassigned: [{ tag: "新語", count: 2 }],
        }),
      ),
    );

    const { result } = renderHookWithQuery(() => useTagGroups());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.unassigned).toEqual([
      { tag: "新語", count: 2 },
    ]);
  });
});

describe("useSetTagAlias", () => {
  it("タグを URL エンコードして PUT し、groupId を body で送る", async () => {
    let received: { path: string; body: unknown } | null = null;
    server.use(
      http.put(
        `${API}/admin/tag-groups/aliases/:tag`,
        async ({ request, params }) => {
          received = { path: String(params.tag), body: await request.json() };
          return HttpResponse.json({ tag: "旅行者", groupId: "tourist" });
        },
      ),
    );

    const { result } = renderHookWithQuery(() => useSetTagAlias());
    result.current.mutate({ tag: "旅行者", groupId: "tourist" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(received).toEqual({
      path: "旅行者",
      body: { groupId: "tourist" },
    });
  });
});

describe("useAssignTagGroups", () => {
  it("remaining が 0 になるまで assign を繰り返し、件数を合算する", async () => {
    const responses = [
      { assigned: 80, unassigned: 20, remaining: 50 },
      { assigned: 40, unassigned: 10, remaining: 0 },
    ];
    let calls = 0;
    server.use(
      http.post(`${API}/admin/tag-groups/assign`, () => {
        const body = responses[calls] ?? responses[responses.length - 1];
        calls += 1;
        return HttpResponse.json(body);
      }),
    );

    const { result } = renderHookWithQuery(() => useAssignTagGroups());
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls).toBe(2);
    expect(result.current.data).toEqual({ assigned: 120, unassigned: 30 });
  });
});

describe("useCreateTagGroup", () => {
  it("グループを POST して作成結果を返す", async () => {
    let received: unknown = null;
    server.use(
      http.post(`${API}/admin/tag-groups`, async ({ request }) => {
        received = await request.json();
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

    const { result } = renderHookWithQuery(() => useCreateTagGroup());
    result.current.mutate({ name: "農家", kind: "attribute", axis: "立場" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(received).toEqual({ name: "農家", kind: "attribute", axis: "立場" });
    expect(result.current.data?.id).toBe("g-1");
  });
});
