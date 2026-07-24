import { ToolEmptyState } from "@nepp-chan/shared";

const frame: React.CSSProperties = {
  padding: 20,
  width: 440,
};

const caption: React.CSSProperties = {
  fontSize: 12,
  color: "var(--fg-3)",
  marginBottom: 8,
};

export const NoSearchResults = () => (
  <div style={frame}>
    <div style={caption}>検索ツールの結果 0 件</div>
    <ToolEmptyState message="「音威子府 ラーメン」に一致するお店は見つかりませんでした。おそば屋さんならご案内できます。" />
  </div>
);

export const NoUpcomingEvents = () => (
  <div style={frame}>
    <div style={caption}>イベントツールの結果 0 件</div>
    <ToolEmptyState message="今週の村内イベントはありません。来月は冬まつりの準備が始まります。" />
  </div>
);
