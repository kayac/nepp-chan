import { describe, expect, it } from "vitest";
import { callTool } from "~/__tests__/helpers/tool-context";
import { displayChartTool } from "./display-chart-tool";

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
