import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { ReportsSection } from "./ReportsSection";

const API = "http://localhost:8787";

const reports = [
  {
    id: "week-3",
    periodStart: "2026-09-21",
    periodEnd: "2026-09-27",
    summary: "9月最終週の要約",
    createdAt: "2026-09-29T05:00:00.000Z",
  },
  {
    id: "week-2",
    periodStart: "2026-09-14",
    periodEnd: "2026-09-20",
    summary: "9月第3週の要約",
    createdAt: "2026-09-22T05:00:00.000Z",
  },
  {
    id: "week-1",
    periodStart: "2026-09-07",
    periodEnd: "2026-09-13",
    summary: "9月第2週の要約",
    createdAt: "2026-09-15T05:00:00.000Z",
  },
];

const stats = {
  conversationCount: 3,
  messageCount: 10,
  hourly: [],
  platforms: [],
  usageByModel: [],
};

const useHandlers = (list: typeof reports = reports) =>
  server.use(
    http.get(`${API}/admin/analytics/reports`, () =>
      HttpResponse.json({ reports: list }),
    ),
    http.get(`${API}/admin/analytics/reports/:id`, ({ params }) => {
      const report = list.find((r) => r.id === params.id);
      return HttpResponse.json({ report: { ...report, stats } });
    }),
  );

const prevButton = () => screen.getByRole("button", { name: "前の週" });
const nextButton = () => screen.getByRole("button", { name: "次の週" });

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("ReportsSection", () => {
  it("最初から最新週の詳細を表示する", async () => {
    useHandlers();
    renderWithQuery(<ReportsSection />);

    expect(await screen.findByText("9月最終週の要約")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("week-3");
  });

  it("前の週・次の週ボタンで週が移る", async () => {
    useHandlers();
    const user = userEvent.setup();
    renderWithQuery(<ReportsSection />);
    await screen.findByText("9月最終週の要約");

    await user.click(prevButton());
    expect(await screen.findByText("9月第3週の要約")).toBeInTheDocument();

    await user.click(nextButton());
    expect(await screen.findByText("9月最終週の要約")).toBeInTheDocument();
  });

  it("最新週では次の週、最も古い週では前の週を押せない", async () => {
    useHandlers();
    const user = userEvent.setup();
    renderWithQuery(<ReportsSection />);
    await screen.findByText("9月最終週の要約");

    expect(nextButton()).toBeDisabled();
    expect(prevButton()).toBeEnabled();

    await user.selectOptions(screen.getByRole("combobox"), "week-1");

    expect(await screen.findByText("9月第2週の要約")).toBeInTheDocument();
    expect(prevButton()).toBeDisabled();
    expect(nextButton()).toBeEnabled();
  });

  it("期間の選択で任意の週へ飛べる", async () => {
    useHandlers();
    const user = userEvent.setup();
    renderWithQuery(<ReportsSection />);
    await screen.findByText("9月最終週の要約");

    await user.selectOptions(
      screen.getByRole("combobox"),
      screen.getByRole("option", { name: "2026-09-07 〜 2026-09-13" }),
    );

    expect(await screen.findByText("9月第2週の要約")).toBeInTheDocument();
  });

  it("レポートが無ければ空状態を表示する", async () => {
    useHandlers([]);
    renderWithQuery(<ReportsSection />);

    expect(
      await screen.findByText("レポートはまだ生成されていません"),
    ).toBeInTheDocument();
  });
});
