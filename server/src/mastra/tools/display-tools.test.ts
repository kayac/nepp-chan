import { describe, expect, it } from "vitest";
import { buildToolContext } from "../../test-helpers/tool-context";
import { displayChartTool } from "./display-chart-tool";
import { displayTableTool } from "./display-table-tool";
import { displayTimelineTool } from "./display-timeline-tool";

const ctx = buildToolContext({});

describe("displayChartTool", () => {
  it("execute は { displayed: true } を返す（UI 側で実描画する宣言）", async () => {
    const result = await displayChartTool.execute!(
      {
        title: "件数",
        type: "bar",
        xKey: "label",
        yKey: "value",
        data: [{ label: "A", value: 1 }],
      },
      ctx,
    );

    expect(result).toEqual({ displayed: true });
  });
});

describe("displayTableTool", () => {
  it("execute は { displayed: true } を返す", async () => {
    const result = await displayTableTool.execute!(
      {
        columns: [{ key: "name", label: "名前" }],
        data: [{ name: "x" }],
      },
      ctx,
    );

    expect(result).toEqual({ displayed: true });
  });
});

describe("displayTimelineTool", () => {
  it("execute は { displayed: true } を返す", async () => {
    const result = await displayTimelineTool.execute!(
      {
        events: [{ date: "3/14", title: "出来事" }],
      },
      ctx,
    );

    expect(result).toEqual({ displayed: true });
  });
});
