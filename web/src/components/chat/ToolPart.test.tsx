import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithQuery } from "~/test/query";

import { mapToolStateToStatus, ToolPart } from "./ToolPart";

describe("mapToolStateToStatus", () => {
  it("input-streaming / input-available は running になる", () => {
    expect(mapToolStateToStatus("input-streaming")).toEqual({
      type: "running",
    });
    expect(mapToolStateToStatus("input-available")).toEqual({
      type: "running",
    });
  });

  it("output-available は complete になる", () => {
    expect(mapToolStateToStatus("output-available")).toEqual({
      type: "complete",
    });
  });

  it("output-error は incomplete(error) になり errorText を載せる", () => {
    expect(mapToolStateToStatus("output-error", "boom")).toEqual({
      type: "incomplete",
      reason: "error",
      error: "boom",
    });
  });
});

describe("ToolPart", () => {
  it("toolsByName に無いツールは ToolFallback で表示する", () => {
    renderWithQuery(
      <ToolPart
        part={
          {
            type: "tool-knowledge-search",
            toolCallId: "tc-1",
            state: "output-available",
            input: { query: "音威子府" },
            output: { results: [] },
          } as never
        }
      />,
    );

    expect(screen.getByText("ねっぷちゃんが調査しました")).toBeInTheDocument();
  });

  it("toolsByName に登録されたツールは対応コンポーネントで表示する", () => {
    renderWithQuery(
      <ToolPart
        part={
          {
            type: "tool-displayTableTool",
            toolCallId: "tc-2",
            state: "output-available",
            input: {
              title: "アクセス",
              columns: [{ key: "from", label: "出発地" }],
              data: [{ from: "旭川" }],
            },
            output: { displayed: true },
          } as never
        }
      />,
    );

    expect(screen.getByText("アクセス")).toBeInTheDocument();
  });
});
