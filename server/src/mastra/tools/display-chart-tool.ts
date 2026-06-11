import { displayChartSchema } from "@nepp-chan/shared/schemas/display-tools";

import { createDisplayTool } from "./display-tool-factory";

export const displayChartTool = createDisplayTool({
  id: "display-chart",
  description: `データをグラフで可視化するツール。
サブエージェントの分析結果やツールの集計結果に件数・割合が含まれている場合、テキストで列挙するよりこのツールを使う。

## チャートタイプの選び方
- bar: カテゴリ別の件数比較（例: トピック別の件数、属性別の人数）
- pie: 全体に対する割合・構成比（例: 感情分布、カテゴリ比率）
- line: 時系列の推移（例: 月別件数の変化、人口推移）

## 使用判断の基準
- 3項目以上の数値比較 → チャートを使う
- 2項目以下 → テキストで十分

## 入力形式
- title: グラフのタイトル
- type: "bar" | "pie" | "line"
- xKey: X軸のキー名（data内のオブジェクトのキーと一致させる）
- yKey: Y軸のキー名（data内のオブジェクトのキーと一致させる。ツールチップに表示される）
- data: xKeyとyKeyをキーに持つオブジェクトの配列

## 入力例
title: "トピック別件数"
type: "bar"
xKey: "トピック"
yKey: "件数"
data: [{ "トピック": "交通", "件数": 5 }, { "トピック": "除雪", "件数": 3 }]

## よくある間違い
- xKey/yKeyとdata内のキー名が一致していない → グラフが空になる
- yKeyの値が文字列になっている → 数値にすること`,
  inputSchema: displayChartSchema,
});
