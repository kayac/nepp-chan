import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { AudienceSection } from "./AudienceSection";

const API = "http://localhost:8787";

const group = (
  id: string,
  name: string,
  over: Record<string, unknown> = {},
) => ({
  id,
  name,
  count: 3,
  topics: [{ topic: "観光", positive: 2, negative: 1, request: 0, neutral: 0 }],
  entities: [{ name: "音威子府駅", count: 2 }],
  tags: [{ tag: "食", count: 1 }],
  samples: [{ content: `${name}の声`, topic: "観光", sentiment: "negative" }],
  ...over,
});

const audiences = {
  axes: [
    {
      axis: "関わり",
      groups: [group("tourist", "観光客"), group("resident", "村内住民")],
    },
    { axis: "年代", groups: [group("teens", "10代")] },
  ],
};

const tagGroups = {
  groups: [
    {
      id: "tourist",
      name: "観光客",
      kind: "attribute",
      axis: "関わり",
      sortOrder: 10,
      tags: [{ tag: "観光客", assignedBy: "seed", count: 3 }],
    },
  ],
  unassigned: [],
};

beforeEach(() => {
  setAuthToken("admin-token");
  server.use(
    http.get(`${API}/admin/analytics/persona/audiences`, () =>
      HttpResponse.json(audiences),
    ),
    http.get(`${API}/admin/tag-groups`, () => HttpResponse.json(tagGroups)),
  );
});

afterEach(() => localStorage.clear());

describe("AudienceSection", () => {
  it("最初の軸のグループをカードで表示し、代表の声と固有名詞を出す", async () => {
    renderWithQuery(<AudienceSection />);

    await waitFor(() =>
      expect(screen.getByText("観光客の声")).toBeInTheDocument(),
    );
    expect(screen.getByText("村内住民の声")).toBeInTheDocument();
    expect(screen.getAllByText("音威子府駅")).toHaveLength(2);
    expect(screen.queryByText("10代の声")).not.toBeInTheDocument();
  });

  it("軸タブを切り替えるとそのグループだけ表示する", async () => {
    renderWithQuery(<AudienceSection />);
    await waitFor(() =>
      expect(screen.getByText("観光客の声")).toBeInTheDocument(),
    );

    await userEvent.click(
      within(screen.getByRole("tablist")).getByRole("tab", { name: "年代" }),
    );

    expect(screen.getByText("10代の声")).toBeInTheDocument();
    expect(screen.queryByText("観光客の声")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "年代" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("属性グループに入る声が無ければ空表示にする", async () => {
    server.use(
      http.get(`${API}/admin/analytics/persona/audiences`, () =>
        HttpResponse.json({ axes: [] }),
      ),
    );

    renderWithQuery(<AudienceSection />);

    await waitFor(() =>
      expect(
        screen.getByText("属性グループに入る声がまだありません"),
      ).toBeInTheDocument(),
    );
  });
});
