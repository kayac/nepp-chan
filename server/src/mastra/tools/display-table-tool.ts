import { createTool } from "@mastra/core/tools";
import { displayTableSchema } from "@nepp-chan/shared/schemas/display-tools";
import { z } from "zod";

export const displayTableTool = createTool({
  id: "display-table",
  description: `データをテーブル形式で表示するツール。
一覧データや複数フィールドの比較を見せたいときに使用する。

## 使用判断の基準
- 2列以上 × 2行以上のデータ → テーブルを使う
- 単純なリスト → テキストで十分

## 入力形式
- title: テーブルのタイトル（省略可）
- columns: 列定義の配列。各要素:
  - key: data内のオブジェクトのキー名（一致必須）
  - label: 列ヘッダーの表示名
  - sortable: ソート可能か（省略可、デフォルトfalse）
- data: columnsのkeyをキーに持つオブジェクトの配列

## 入力例
title: "施設一覧"
columns: [
  { "key": "name", "label": "施設名" },
  { "key": "hours", "label": "営業時間" },
  { "key": "tel", "label": "電話番号", "sortable": false }
]
data: [
  { "name": "道の駅", "hours": "9:00-17:00", "tel": "01656-5-xxxx" }
]

## よくある間違い
- columnsのkeyとdata内のキー名が一致していない → 列が空になる
- columnsを省略 → 必須フィールド`,
  inputSchema: displayTableSchema,
  outputSchema: z.object({
    displayed: z.boolean(),
  }),
  execute: async () => {
    return { displayed: true };
  },
});
