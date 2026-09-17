import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { TagAssignment } from "./TagAssignment";

const API = "http://localhost:8787";

const tagGroups = {
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
    { tag: "新語", count: 5 },
    { tag: "謎", count: 1 },
  ],
};

beforeEach(() => {
  setAuthToken("admin-token");
  server.use(
    http.get(`${API}/admin/tag-groups`, () => HttpResponse.json(tagGroups)),
  );
});

afterEach(() => localStorage.clear());

describe("TagAssignment", () => {
  it("未分類タグを件数つきで並べ、属性グループだけを最初に表示する", async () => {
    renderWithQuery(<TagAssignment />);

    await waitFor(() => expect(screen.getByText("新語")).toBeInTheDocument());
    expect(
      screen.getByText("タグの割り当て（未分類 2 件）"),
    ).toBeInTheDocument();

    const groupsSection = screen
      .getByText("グループと所属タグ")
      .closest("section") as HTMLElement;
    const groups = within(groupsSection);
    expect(groups.getByText("関わり / 観光客")).toBeInTheDocument();
    expect(groups.queryByText("除外")).not.toBeInTheDocument();

    await userEvent.click(
      groups.getByRole("button", { name: "話題・除外も表示" }),
    );
    expect(groups.getByText("除外")).toBeInTheDocument();
  });

  it("未分類タグにグループを選ぶと PUT で割り当てる", async () => {
    let received: { tag: string; body: unknown } | null = null;
    server.use(
      http.put(
        `${API}/admin/tag-groups/aliases/:tag`,
        async ({ params, request }) => {
          received = { tag: String(params.tag), body: await request.json() };
          return HttpResponse.json({ tag: params.tag, groupId: "tourist" });
        },
      ),
    );
    renderWithQuery(<TagAssignment />);
    await waitFor(() => expect(screen.getByText("新語")).toBeInTheDocument());

    await userEvent.selectOptions(
      screen.getByLabelText("新語 の割り当て先"),
      "tourist",
    );

    await waitFor(() =>
      expect(received).toEqual({ tag: "新語", body: { groupId: "tourist" } }),
    );
  });

  it("所属タグをクリックすると未分類に戻す", async () => {
    let received: unknown = null;
    server.use(
      http.put(`${API}/admin/tag-groups/aliases/:tag`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ tag: "旅行者", groupId: null });
      }),
    );
    renderWithQuery(<TagAssignment />);
    await waitFor(() => expect(screen.getByText("旅行者")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /旅行者/ }));

    await waitFor(() => expect(received).toEqual({ groupId: null }));
  });

  it("グループ名と軸を入れて追加すると POST し、入力を空に戻す", async () => {
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
    renderWithQuery(<TagAssignment />);
    await waitFor(() => expect(screen.getByText("新語")).toBeInTheDocument());

    const submit = screen.getByRole("button", { name: "グループを追加" });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText("グループ名"), "農家");
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText("軸"), "立場");
    await userEvent.click(submit);

    await waitFor(() =>
      expect(received).toEqual({
        name: "農家",
        kind: "attribute",
        axis: "立場",
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("グループ名")).toHaveValue(""),
    );
  });

  it("話題グループは軸なしで追加できる", async () => {
    let received: unknown = null;
    server.use(
      http.post(`${API}/admin/tag-groups`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          {
            id: "g-2",
            name: "農業",
            kind: "topic",
            axis: null,
            sortOrder: 370,
          },
          { status: 201 },
        );
      }),
    );
    renderWithQuery(<TagAssignment />);
    await waitFor(() => expect(screen.getByText("新語")).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText("種別"), "topic");
    expect(screen.queryByLabelText("軸")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("グループ名"), "農業");
    await userEvent.click(
      screen.getByRole("button", { name: "グループを追加" }),
    );

    await waitFor(() =>
      expect(received).toEqual({ name: "農業", kind: "topic", axis: null }),
    );
  });

  it("LLM で振り分けを押すと remaining 0 まで繰り返し、合計を表示する", async () => {
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
    renderWithQuery(<TagAssignment />);
    await waitFor(() => expect(screen.getByText("新語")).toBeInTheDocument());

    await userEvent.click(
      screen.getByRole("button", { name: "LLM で振り分け" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("1 件を割り当て、1 件は判断できず未分類"),
      ).toBeInTheDocument(),
    );
  });
});
