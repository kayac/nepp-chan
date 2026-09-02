---
paths:
  - server/src/**
---

# データアクセス

## SQL を書くのは repository だけ

`createDb` / drizzle のクエリビルダ / `sql` テンプレートを使うのは `server/src/repository/**` に限る。service・routes・handlers・mastra からは repository のメソッドを呼ぶ。

呼び出しの階層は自由（repository → service → routes / repository → routes / service → routes のいずれも可）。縛るのは「DB 操作の入口は repository」だけ。

## 置き場の判断

| 状況 | 置き場 |
| ---- | ------ |
| 返す行が 1 つのテーブルのもの（JOIN の有無は問わない） | そのテーブルの repository |
| 返り値が複数テーブルにまたがる / 主テーブルがない | service が各 repository を呼んで組み立てる |

複数テーブルを横断する処理（保管期間削除・ユーザー削除など）は service に置く。ただし service が `createDb` して直接 delete するのではなく、各 repository の削除メソッドを呼ぶオーケストレーターにする。

## 例外

パフォーマンス上どうしても 1 本の SQL で書きたい横断クエリだけ例外。その場合は「どのドメインの問いに答えるクエリか」で repository を選び、意図はメソッド名で表す（`findThreadsWithUsage` のように）。

## 既存コード

`services/analytics/*` `services/data-retention.ts` `services/persona-extractor.ts` 等にこの原則より前の直接アクセスが残っている。触る機会があれば repository へ寄せるが、この原則のためだけの一括リファクタはしない。
