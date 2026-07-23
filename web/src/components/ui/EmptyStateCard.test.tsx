import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyStateCard } from "./EmptyStateCard";

describe("EmptyStateCard", () => {
  it("children を表示する", () => {
    render(<EmptyStateCard>データがありません</EmptyStateCard>);

    expect(screen.getByText("データがありません")).toBeInTheDocument();
  });
});
