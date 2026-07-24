import { ToolPart } from "@nepp-chan/shared";

const chartFrame: React.CSSProperties = {
  width: 480,
  padding: 16,
};

const frame: React.CSSProperties = {
  maxWidth: 520,
  padding: 16,
};

export const PopulationChart = () => (
  <div style={chartFrame}>
    <ToolPart
      part={{
        type: "tool-displayChartTool",
        toolCallId: "call-chart-1",
        state: "output-available",
        input: {
          title: "音威子府村の人口推移",
          type: "bar",
          data: [
            { 年: "1980", 人口: 1494 },
            { 年: "1990", 人口: 1275 },
            { 年: "2000", 人口: 1145 },
            { 年: "2010", 人口: 995 },
            { 年: "2020", 人口: 831 },
          ],
          xKey: "年",
          yKey: "人口",
        },
        output: { displayed: true },
      }}
    />
  </div>
);

export const SpotsTable = () => (
  <div style={frame}>
    <ToolPart
      part={{
        type: "tool-displayTableTool",
        toolCallId: "call-table-1",
        state: "output-available",
        input: {
          title: "音威子府村の観光スポット",
          columns: [
            { key: "name", label: "名称" },
            { key: "genre", label: "ジャンル" },
            { key: "access", label: "中心部からの目安" },
          ],
          data: [
            {
              name: "エコミュージアムおさしまセンター",
              genre: "アート",
              access: "車で約10分",
            },
            { name: "天塩川温泉", genre: "温泉", access: "車で約8分" },
            { name: "北海道命名之地", genre: "史跡", access: "車で約12分" },
            {
              name: "道の駅おといねっぷ",
              genre: "お土産・そば",
              access: "徒歩約5分",
            },
          ],
        },
        output: { displayed: true },
      }}
    />
  </div>
);

export const FestivalTimeline = () => (
  <div style={frame}>
    <ToolPart
      part={{
        type: "tool-displayTimelineTool",
        toolCallId: "call-timeline-1",
        state: "output-available",
        input: {
          title: "天塩川まつり 準備スケジュール",
          events: [
            {
              date: "6月10日",
              title: "実行委員会キックオフ",
              description: "村役場で第1回の実行委員会を開催",
              status: "completed",
              type: "event",
            },
            {
              date: "7月1日",
              title: "出店申し込み締切",
              status: "completed",
              type: "deadline",
            },
            {
              date: "7月20日",
              title: "会場設営スタート",
              description: "河川敷の草刈りとテント設営",
              status: "current",
              type: "event",
            },
            {
              date: "8月2日",
              title: "天塩川まつり当日",
              description: "花火大会は20時から",
              status: "upcoming",
              type: "milestone",
            },
          ],
        },
        output: { displayed: true },
      }}
    />
  </div>
);

export const ChartLoading = () => (
  <div style={chartFrame}>
    <ToolPart
      part={{
        type: "tool-displayChartTool",
        toolCallId: "call-chart-2",
        state: "input-streaming",
        input: { title: "音威子府村の人口推移" },
      }}
    />
  </div>
);
