import { describe, expect, it } from "vitest";
import { callTool } from "../../test-helpers/tool-context";
import { displayChartTool } from "./display-chart-tool";
import { displayTableTool } from "./display-table-tool";
import { displayTimelineTool } from "./display-timeline-tool";

describe("displayChartTool", () => {
  it("execute は { displayed: true } を返す（UI 側で実描画する宣言）", async () => {
    const result = await callTool(displayChartTool, {
      title: "件数",
      type: "bar",
      xKey: "label",
      yKey: "value",
      data: [{ label: "A", value: 1 }],
    });

    expect(result).toEqual({ displayed: true });
  });
});

describe("displayTableTool", () => {
  it("execute は { displayed: true } を返す", async () => {
    const result = await callTool(displayTableTool, {
      columns: [{ key: "name", label: "名前" }],
      data: [{ name: "x" }],
    });

    expect(result).toEqual({ displayed: true });
  });
});

describe("displayTimelineTool", () => {
  it("execute は { displayed: true } を返す", async () => {
    const result = await callTool(displayTimelineTool, {
      events: [{ date: "3/14", title: "出来事" }],
    });

    expect(result).toEqual({ displayed: true });
  });
});
