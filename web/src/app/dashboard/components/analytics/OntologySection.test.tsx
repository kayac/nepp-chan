import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthToken } from "~/lib/auth-token";
import { server } from "~/test/msw-server";
import { renderWithQuery } from "~/test/query";
import { OntologySection } from "./OntologySection";

const API = "http://localhost:8787";

const ontology = {
  nodes: [
    {
      id: "seg:観光客",
      label: "観光客",
      kind: "segment",
      count: 5,
      role: "セグメント",
      roles: [],
    },
    {
      id: "top:観光",
      label: "観光",
      kind: "topic",
      count: 5,
      role: "関心点",
      roles: ["関心点"],
      bySegment: { 観光客: 5 },
      bySentiment: { neutral: 5 },
    },
  ],
  links: [
    { source: "seg:観光客", target: "top:観光", n: 5, kind: "seg-topic" },
  ],
  meta: {
    personaTotal: 5,
    generatedAt: "2026-06-15T00:00:00.000Z",
    entityLayerStatus: "none",
    note: "",
  },
};

const useOntologyHandler = () =>
  server.use(
    http.get(`${API}/admin/analytics/ontology`, () =>
      HttpResponse.json(ontology),
    ),
  );

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
});

describe("OntologySection", () => {
  it("グラフと役割凡例を表示する", async () => {
    useOntologyHandler();
    renderWithQuery(<OntologySection />);

    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "村の声グラフ" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("村内と村外をつなぐ")).toBeInTheDocument();
    expect(screen.getByText("ポジとネガが混在")).toBeInTheDocument();
  });

  it("ノードをクリックすると内訳を表示する", async () => {
    useOntologyHandler();
    const user = userEvent.setup();
    renderWithQuery(<OntologySection />);

    const node = await screen.findByRole("button", {
      name: "観光（関心点・5件）",
    });
    await user.click(node);

    expect(screen.getByText("誰が")).toBeInTheDocument();
    expect(screen.getByText("どんな感情で")).toBeInTheDocument();
    expect(screen.getByText("トピック（全数集計）・5 件")).toBeInTheDocument();
  });

  it("未選択時はガイドメッセージを表示する", async () => {
    useOntologyHandler();
    renderWithQuery(<OntologySection />);

    await waitFor(() =>
      expect(
        screen.getByText(/ノードをクリックすると「誰が・どんな感情で」の内訳/),
      ).toBeInTheDocument(),
    );
  });

  it("API エラー時はエラーを表示する", async () => {
    server.use(
      http.get(`${API}/admin/analytics/ontology`, () =>
        HttpResponse.json({ error: "boom" }, { status: 500 }),
      ),
    );
    renderWithQuery(<OntologySection />);

    await waitFor(() =>
      expect(screen.getByText(/エラー:/)).toBeInTheDocument(),
    );
  });
});
