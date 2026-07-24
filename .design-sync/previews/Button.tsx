import { PaperAirplaneIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button } from "@nepp-chan/shared";

const row: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  padding: 16,
};

export const Variants = () => (
  <div style={row}>
    <Button>話しかける</Button>
    <Button variant="secondary">下書きを保存</Button>
    <Button variant="outline">キャンセル</Button>
    <Button variant="ghost">スキップ</Button>
    <Button variant="destructive">削除する</Button>
    <Button variant="link">利用規約を読む</Button>
  </div>
);

export const Sizes = () => (
  <div style={row}>
    <Button size="sm">小さめ</Button>
    <Button size="default">ふつう</Button>
    <Button size="lg">大きめ</Button>
    <Button size="icon" aria-label="送信">
      <PaperAirplaneIcon />
    </Button>
  </div>
);

export const WithIcon = () => (
  <div style={row}>
    <Button>
      <PaperAirplaneIcon />
      送信する
    </Button>
    <Button variant="destructive">
      <TrashIcon />
      スレッドを削除
    </Button>
  </div>
);

export const Disabled = () => (
  <div style={row}>
    <Button disabled>送信する</Button>
    <Button variant="outline" disabled>
      キャンセル
    </Button>
  </div>
);
