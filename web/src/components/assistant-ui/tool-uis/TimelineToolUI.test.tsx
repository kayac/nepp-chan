import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it } from "vitest";

import { DisplayTimelineToolComponent } from "./TimelineToolUI";

// テストで使うサブセットのみ型付けし、assistant-ui の厳密な ToolCallMessagePart 型は緩めて受ける
const Comp = DisplayTimelineToolComponent as unknown as (
  props: Record<string, unknown>,
) => React.ReactElement;

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
    <Comp
      args={args}
      argsText=""
      result={undefined}
      status={{ type: "complete", reason: "stop" }}
      toolCallId="t-1"
      toolName="displayTimelineTool"
      addResult={() => undefined}
      type="tool-call"
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
      <Comp
        args={{ events: [] }}
        argsText=""
        result={undefined}
        status={{ type: "complete", reason: "stop" }}
        toolCallId="t-1"
        toolName="displayTimelineTool"
        addResult={() => undefined}
        type="tool-call"
      />,
    );
    expect(screen.getByText("表示するイベントがありません")).toBeDefined();
  });

  it("running + events なし はローディングを出す", () => {
    render(
      <Comp
        args={{}}
        argsText=""
        result={undefined}
        status={{ type: "running" }}
        toolCallId="t-1"
        toolName="displayTimelineTool"
        addResult={() => undefined}
        type="tool-call"
      />,
    );
    expect(screen.queryByText("イベント表")).toBeNull();
  });
});
