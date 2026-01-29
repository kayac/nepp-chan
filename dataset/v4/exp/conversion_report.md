---
id: conversion_report
title: v3exp移行レポート
category: メタ情報
tags: [レポート, 移行, スタイルガイド]
related: [root_index]
updated: 2026-01-14
---

# v3exp 移行レポートとスタイル定義

本ドキュメントは、`knowledge/v2src/villotoinep` から `knowledge/v3exp` への移行作業に関するレポートおよび、v3expのスタイル（書き方）の言語化をまとめたものです。

## 1. スタイルの言語化 (Style Definition)

Mastra.aiのmDocumentでの利用および人間によるメンテナンス性を考慮し、以下のスタイルガイドラインを策定・適用しました。

### 構造とフォーマット
1.  **Frontmatter**: ファイル冒頭にYAML Frontmatterを必須とする。
    *   `id`: 英数字のスネークケース（ファイル名と一致させる）。
    *   `title`: 日本語のタイトル。
    *   `category`: `_index.md` で定義された大カテゴリ（基本情報、行政、暮らし、防災、産業、観光・施設）。
    *   `tags`: 検索用タグの配列。
    *   `related`: 関連するドキュメントIDの配列。
    *   `updated`: 最終更新日。
2.  **見出し構成**:
    *   `#` (H1): タイトルと一致させる。
    *   `##` (H2): 主要セクション。
    *   `###` (H3): サブセクション。
    *   **導入文**: H1の直後に、そのドキュメントが何を記述しているか簡潔な要約を記載する。
3.  **記述スタイル**:
    *   **構造化データ**: リスト（`-`）やテーブル（Markdown Table）を積極的に使用し、長文のベタ打ちを避ける。
    *   **事実中心**: 「〜と思われます」等の推測表現を避け、事実を簡潔に記述する。
    *   **Q&Aセクション**: 可能な限り、ドキュメントの末尾に `## よくある質問` セクションを設け、ユーザーの疑問に直接答える形式をとる（RAGの回答精度向上）。
4.  **ファイル粒度**:
    *   Webサイトのページ単位ではなく、「トピック単位」でファイルを構成する。
    *   細かすぎるファイル（リンク集のみ等）は関連トピックと統合し、巨大すぎるファイル（行政計画全文等）は要約または分割する。

## 2. 移行・統合レポート (Conversion Report)

`v2src/villotoinep` 以下のファイルを、上記のスタイルに基づき整理・統合しました。

| 新ファイル名 (v3exp) | カテゴリ | 元ファイル (v2src/villotoinep) | 変更点・統合理由 |
|---|---|---|---|
| **basic_info.md** | 基本情報 | `about/gaiyou.md`<br>`about/ichi_kisyou.md`<br>`about/jinkou_kokudo.md` | 村の基本情報（概要、位置、人口）として1つに統合し、一覧性を向上。 |
| **access.md** | 基本情報 | `about/access.md` | (既存ファイルを維持) 交通情報を集約。 |
| **mayor.md** | 行政 | `village_mayor/index.md` | (既存ファイルを維持) 村長の挨拶を引用形式にし、要点を構造化。 |
| **administration.md** | 行政 | `gyousei/gyouzaisei.md`<br>`gyousei/keikaku.md`<br>`gyousei/muraokoshi.md` | 財政報告、総合計画などの行政資料リンクと地域おこし情報を統合。 |
| **departments.md** | 行政 | `kakuka/index.md` | 組織図・連絡先一覧として独立。 |
| **recruitment.md** | 行政 | `gyousei/saiyou.md` | 「採用情報」という明確なニーズがあるため、独立ファイル化。 |
| **procedures_taxes.md** | 暮らし | `kurashi/tetsuduki.md`<br>`kurashi/zeikin.md` | 手続きと税金は密接に関連するため統合。表形式で納期等を整理。 |
| **garbage_recycling.md** | 暮らし | `kurashi/gomi_kankyou.md` | リンク集だけでなく、重要な変更点（ゴミ袋の仕様変更等）を本文に記述。 |
| **health_welfare.md** | 暮らし | `kurashi/kenkou_fukushi.md` | 助成制度を表形式で整理。 |
| **education.md** | 暮らし | `kurashi/manabi.md` | 学校、社会教育、スポーツを網羅。既存の内容が充実していたため構造化のみ実施。 |
| **industry.md** | 産業 | `sangyou/nougyou.md`<br>`sangyou/ringyou.md` | 農業と林業を「産業」として統合。計画関連リンクを整理。 |
| **facilities.md** | 観光・施設 | `shisetsu/index.md` | リンク集を施設カテゴリ（観光、スポーツ、医療等）ごとに分類して記述。 |
| **disaster_prevention.md** | 防災 | `bousai/index.md`<br>`pdf/parsed/jishin202003.md` (一部) | 大量にあるPDFリンクや長大な計画書から、住民に必要な「行動指針」「備え」を抽出し要約。 |

## 3. 今後の運用について
- **ファイル追加時**: 新しいトピックが増えた場合は、カテゴリルールに従って適切なカテゴリディレクトリ（またはフラットな構造におけるカテゴリタグ）を設定してください。
- **更新**: `updated` フィールドを必ず更新してください。
