---
paths:
  - web/src/**
  - lp/src/**
---

# Web / LP 規約

## デザイン

体験の哲学・デザイン原則・文言の話者基準はルート `DESIGN.md` を参照。
体験設計の壁打ちとデザイン案の作成は `/np-design` スキルを使う。

## スタイル

TailwindCSS utility class のみ。BEM 不採用。CSS 変数は `bg-(--paper-50)` 形式。

## shared パッケージ

web/lp で UI が必要になったら `@nepp-chan/shared` を最初に確認。新規 UI も両側で使える性質なら shared に置く。

## web ディレクトリ規約

- `app/dashboard/components/<feature>/` 内の helper は `helpers.ts` に集約
- feature 間の越境 import 禁止。共有は `src/lib/` か `components/ui/` に昇格
- 新しい配置前に同種の既存ファイルを grep で確認
