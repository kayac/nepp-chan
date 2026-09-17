import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { TagGroupsPanel } from "./TagGroupsPanel";

const API = "http://localhost:8787";

const overview = {
  groups: [
    {
      id: "tourist",
      name: "観光客",
      kind: "attribute",
      axis: "関わり",
      sortOrder: 10,
      tags: [{ tag: "旅行者", assignedBy: "llm", count: 4 }],
    },
    {
      id: "exclude",
      name: "除外",
      kind: "exclude",
      axis: null,
      sortOrder: 9000,
      tags: [],
    },
  ],
  unassigned: [
    { tag: "低予算", count: 19, example: "予算を抑えて回りたい" },
    { tag: "年代不明", count: 13, example: null },
  ],
  recent: [
    {
      tag: "旅行者",
      groupId: "tourist",
      groupName: "観光客",
      assignedAt: "2026-09-16T00:00:00.000Z",
    },
  ],
};

let puts: { tag: string; body: unknown }[] = [];

beforeEach(() => {
  setAuthToken("admin-token");
  puts = [];
  server.use(
    http.get(`${API}/admin/tag-groups`, () => HttpResponse.json(overview)),
    http.put(
      `${API}/admin/tag-groups/aliases/:tag`,
      async ({ params, request }) => {
        puts.push({ tag: String(params.tag), body: await request.json() });
        return HttpResponse.json({ tag: params.tag, groupId: null });
      },
    ),
  );
});

afterEach(() => localStorage.clear());

describe("TagGroupsPanel", () => {
  it("判断待ちを件数と例文つきで出し、最近の自動振り分けも出す", async () => {
    renderWithQuery(<TagGroupsPanel />);

    await waitFor(() => expect(screen.getByText("低予算")).toBeInTheDocument());
    expect(screen.getByText("判断待ち").parentElement?.textContent).toContain(
      "2 件",
    );
    expect(
      screen.getByText("例: 「予算を抑えて回りたい」"),
    ).toBeInTheDocument();
    expect(screen.getByText("最近自動で振り分けたもの")).toBeInTheDocument();
  });

  it("判断待ちにグループを選ぶと割り当て、集計対象外にするは除外に入れる", async () => {
    renderWithQuery(<TagGroupsPanel />);
    await waitFor(() => expect(screen.getByText("低予算")).toBeInTheDocument());

    await userEvent.selectOptions(
      screen.getByLabelText("低予算 の割り当て先"),
      "tourist",
    );
    await waitFor(() =>
      expect(puts).toContainEqual({
        tag: "低予算",
        body: { groupId: "tourist" },
      }),
    );

    const row = screen.getByText("年代不明").closest("li") as HTMLElement;
    await userEvent.click(
      within(row).getByRole("button", { name: "集計対象外にする" }),
    );
    await waitFor(() =>
      expect(puts).toContainEqual({
        tag: "年代不明",
        body: { groupId: "exclude" },
      }),
    );
  });

  it("最近の自動振り分けを判断待ちに戻せる", async () => {
    renderWithQuery(<TagGroupsPanel />);
    await waitFor(() =>
      expect(screen.getByText("最近自動で振り分けたもの")).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "判断待ちに戻す" }),
    );

    await waitFor(() =>
      expect(puts).toContainEqual({ tag: "旅行者", body: { groupId: null } }),
    );
  });

  it("自動で振り分けるは残数 0 まで繰り返し、結果を平易な文で出す", async () => {
    const responses = [
      { assigned: 1, unassigned: 0, remaining: 1 },
      { assigned: 0, unassigned: 1, remaining: 0 },
    ];
    server.use(
      http.post(`${API}/admin/tag-groups/assign`, () =>
        HttpResponse.json(
          responses.shift() ?? { assigned: 0, unassigned: 0, remaining: 0 },
        ),
      ),
    );
    renderWithQuery(<TagGroupsPanel />);
    await waitFor(() => expect(screen.getByText("低予算")).toBeInTheDocument());

    await userEvent.click(
      screen.getByRole("button", { name: "未分類のタグを自動で振り分ける" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          "1 件を振り分けました。1 件は判断できず未分類のままです",
        ),
      ).toBeInTheDocument(),
    );
  });

  it("グループ一覧と割り当て先は種別ごとに分けて出す", async () => {
    renderWithQuery(<TagGroupsPanel />);
    await waitFor(() => expect(screen.getByText("低予算")).toBeInTheDocument());

    const section = screen
      .getByText("グループ")
      .closest("section") as HTMLElement;
    const attribute = within(section).getByText("話者の属性")
      .parentElement as HTMLElement;
    expect(within(attribute).getByText("関わり / 観光客")).toBeInTheDocument();
    const excluded = within(section).getByText("集計対象外")
      .parentElement as HTMLElement;
    expect(within(excluded).getByText("除外")).toBeInTheDocument();

    const select = screen.getByLabelText("低予算 の割り当て先");
    expect(
      within(select).getByRole("group", { name: "話者の属性" }),
    ).toBeInTheDocument();
    expect(
      within(select).queryByRole("group", { name: "集計対象外" }),
    ).toBeNull();
  });

  it("＋ グループを追加で初めてフォームが開き、追加すると閉じる", async () => {
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
    renderWithQuery(<TagGroupsPanel />);
    await waitFor(() => expect(screen.getByText("低予算")).toBeInTheDocument());
    expect(screen.queryByLabelText("グループ名")).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "＋ グループを追加" }),
    );
    await userEvent.type(screen.getByLabelText("グループ名"), "農家");
    await userEvent.type(screen.getByLabelText("軸"), "立場");
    await userEvent.click(
      screen.getByRole("button", { name: "グループを追加" }),
    );

    await waitFor(() =>
      expect(received).toEqual({
        name: "農家",
        kind: "attribute",
        axis: "立場",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("グループ名")).toBeNull(),
    );
  });
});
