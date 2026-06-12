import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { OntologySection } from "./OntologySection";
import { ONTOLOGY_NODES } from "./ontology-data";

describe("OntologySection", () => {
  it("グラフと役割凡例を表示する", () => {
    render(<OntologySection />);

    expect(screen.getByText("村の声グラフ")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "村の声グラフ" }),
    ).toBeInTheDocument();
    // 役割凡例
    expect(screen.getByText("村内と村外をつなぐ")).toBeInTheDocument();
    expect(screen.getByText("ポジとネガが混在")).toBeInTheDocument();
  });

  it("ノードをクリックすると内訳を表示する", async () => {
    const user = userEvent.setup();
    render(<OntologySection />);

    // 静的データから実在のエンティティノードを選ぶ
    const target = ONTOLOGY_NODES.find((n) => n.kind === "entity");
    expect(target).toBeDefined();
    if (!target) return;

    await user.click(
      screen.getByRole("button", {
        name: `${target.label}（${target.role}・${target.count}件）`,
      }),
    );

    expect(screen.getByText("誰が")).toBeInTheDocument();
    expect(screen.getByText("どんな感情で")).toBeInTheDocument();
    expect(
      screen.getByText(`エンティティ（サンプル抽出）・${target.count} 件`),
    ).toBeInTheDocument();
  });

  it("未選択時はガイドメッセージを表示する", () => {
    render(<OntologySection />);

    expect(
      screen.getByText(/ノードをクリックすると「誰が・どんな感情で」の内訳/),
    ).toBeInTheDocument();
  });
});
