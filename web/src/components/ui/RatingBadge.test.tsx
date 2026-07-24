import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RatingBadge } from "./RatingBadge";

describe("RatingBadge", () => {
  it("good なら「良い回答」を表示する", () => {
    render(<RatingBadge rating="good" />);

    expect(screen.getByText("良い回答")).toBeInTheDocument();
  });

  it("idea なら「アイデア」を表示する", () => {
    render(<RatingBadge rating="idea" />);

    expect(screen.getByText("アイデア")).toBeInTheDocument();
  });

  it("bad なら「改善が必要」を表示する", () => {
    render(<RatingBadge rating="bad" />);

    expect(screen.getByText("改善が必要")).toBeInTheDocument();
  });
});
