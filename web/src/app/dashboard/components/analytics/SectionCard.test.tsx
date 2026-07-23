import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  SectionCard,
  SectionEmpty,
  SectionError,
  SectionLoading,
} from "./SectionCard";

describe("SectionCard", () => {
  it("title と children を表示する", () => {
    render(<SectionCard title="利用状況">中身</SectionCard>);

    expect(screen.getByText("利用状況")).toBeInTheDocument();
    expect(screen.getByText("中身")).toBeInTheDocument();
  });

  it("description がなければ表示しない", () => {
    const { container } = render(
      <SectionCard title="利用状況">中身</SectionCard>,
    );

    expect(container.querySelector("p")).toBeNull();
  });

  it("description があれば表示する", () => {
    render(
      <SectionCard title="利用状況" description="直近7日間">
        中身
      </SectionCard>,
    );

    expect(screen.getByText("直近7日間")).toBeInTheDocument();
  });
});

describe("SectionLoading", () => {
  it("読み込み中を表示する", () => {
    render(<SectionLoading />);

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });
});

describe("SectionEmpty", () => {
  it("children を表示する", () => {
    render(<SectionEmpty>データがありません</SectionEmpty>);

    expect(screen.getByText("データがありません")).toBeInTheDocument();
  });
});

describe("SectionError", () => {
  it("Error インスタンスなら message を表示する", () => {
    render(<SectionError error={new Error("取得に失敗しました")} />);

    expect(screen.getByText("エラー: 取得に失敗しました")).toBeInTheDocument();
  });

  it("Error インスタンスでなければ Unknown error を表示する", () => {
    render(<SectionError error="文字列エラー" />);

    expect(screen.getByText("エラー: Unknown error")).toBeInTheDocument();
  });
});
