import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DisplayTimelineToolComponent } from "./TimelineToolUI";

const baseArgs = {
  title: "イベント表",
  events: [
    {
      date: "2024-01-01",
      title: "完了済み",
      description: "x",
      status: "completed" as const,
    },
    {
      date: "2024-02-01",
      title: "進行中",
      status: "current" as const,
      type: "milestone" as const,
    },
    {
      date: "2024-03-01",
      title: "未来",
      type: "deadline" as const,
    },
  ],
};

const renderTimeline = (args: typeof baseArgs) =>
  render(
    <DisplayTimelineToolComponent
      args={args}
      argsText=""
      result={undefined}
      status={{ type: "complete" }}
      toolName="displayTimelineTool"
    />,
  );

describe("DisplayTimelineToolComponent", () => {
  it("title と全イベントの title を描画", () => {
    renderTimeline(baseArgs);
    expect(screen.getByText("イベント表")).toBeDefined();
    expect(screen.getByText("完了済み")).toBeDefined();
    expect(screen.getByText("進行中")).toBeDefined();
    expect(screen.getByText("未来")).toBeDefined();
  });

  it("milestone / deadline タイプのバッジを描画", () => {
    renderTimeline(baseArgs);
    expect(screen.getByText("マイルストーン")).toBeDefined();
    expect(screen.getByText("締切")).toBeDefined();
  });

  it("description ありなら表示", () => {
    renderTimeline(baseArgs);
    expect(screen.getByText("x")).toBeDefined();
  });

  it("events が 0 件なら空状態を表示", () => {
    render(
      <DisplayTimelineToolComponent
        args={{ events: [] }}
        argsText=""
        result={undefined}
        status={{ type: "complete" }}
        toolName="displayTimelineTool"
      />,
    );
    expect(screen.getByText("表示するイベントがありません")).toBeDefined();
  });

  it("running + events なし はローディングを出す", () => {
    render(
      <DisplayTimelineToolComponent
        args={{}}
        argsText=""
        result={undefined}
        status={{ type: "running" }}
        toolName="displayTimelineTool"
      />,
    );
    expect(screen.queryByText("イベント表")).toBeNull();
  });
});
