import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card } from "./Card";

describe("Card", () => {
  it("見出しと中身を出す", () => {
    render(
      <Card title="新しい声">
        <p>熊の出没</p>
      </Card>,
    );

    expect(screen.getByRole("heading", { name: "新しい声" })).toBeVisible();
    expect(screen.getByText("熊の出没")).toBeVisible();
  });

  it("action を見出しの横に出す", () => {
    render(
      <Card title="新しい声" action={<button type="button">すべて見る</button>}>
        <p>本文</p>
      </Card>,
    );

    expect(screen.getByRole("button", { name: "すべて見る" })).toBeVisible();
  });

  it("action がなければ見出しだけ", () => {
    render(
      <Card title="新しい声">
        <p>本文</p>
      </Card>,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });
});
