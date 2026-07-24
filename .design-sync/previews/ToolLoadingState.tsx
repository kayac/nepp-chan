import {
  CalendarIcon,
  ChartBarIcon,
  ListBulletIcon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import { ToolLoadingState } from "@nepp-chan/shared";

const frame: React.CSSProperties = {
  padding: 20,
  width: 480,
};

const caption: React.CSSProperties = {
  fontSize: 12,
  color: "var(--fg-3)",
  marginBottom: 8,
};

const iconStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  color: "var(--teal-600)",
};

export const Chart = () => (
  <div style={frame}>
    <div style={caption}>chart — 人口推移グラフの生成待ち</div>
    <ToolLoadingState variant="chart" icon={<ChartBarIcon style={iconStyle} />} />
  </div>
);

export const Table = () => (
  <div style={frame}>
    <div style={caption}>table — 村内施設一覧の取得待ち</div>
    <ToolLoadingState variant="table" icon={<TableCellsIcon style={iconStyle} />} />
  </div>
);

export const Timeline = () => (
  <div style={frame}>
    <div style={caption}>timeline — 冬まつりのスケジュール取得待ち</div>
    <ToolLoadingState
      variant="timeline"
      icon={<CalendarIcon style={iconStyle} />}
    />
  </div>
);

export const Choice = () => (
  <div style={frame}>
    <div style={caption}>choice — アンケート選択肢の生成待ち</div>
    <ToolLoadingState variant="choice" icon={<ListBulletIcon style={iconStyle} />} />
  </div>
);
