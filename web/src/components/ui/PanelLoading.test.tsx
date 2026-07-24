import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PanelLoading } from "./PanelLoading";

describe("PanelLoading", () => {
  it("読み込み中を表示する", () => {
    render(<PanelLoading />);

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });
});
