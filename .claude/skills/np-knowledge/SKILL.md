# np-knowledge - ナレッジ管理スキル

## 概要

nepp-chan RAG システムのナレッジデータを管理する統合スキル。
dataset → knowledge 同期、frontmatter 付与、R2/Vectorize アップロードの3段階パイプライン。

## パイプライン

```
np:syncKnowledge       np:frontmatter              np:uploadKnowledge
dataset/v*/src/   →   frontmatter を          →   R2 → Vectorize に
knowledge/ に同期      付与・抽出・レビュー          アップロード
```

## スクリプト一覧

| スクリプト | pnpm コマンド | 説明 |
|-----------|-------------|------|
| `upload-knowledge.ts` | `knowledge:upload:<env>` | R2 にアップロード |
| `convert-tables-to-json.ts` | — | MD テーブルを JSON ブロックに変換 |
| `add-frontmatter.ts` | `frontmatter:add` | title/category/subcategory/url を一括付与 |
| `extract-date-contact.ts` | `frontmatter:extract` | LLM 2パスで date/contact/date_type を抽出→TSV |
| `apply-date-contact.ts` | `frontmatter:apply` | 抽出・レビュー結果を frontmatter に書き込み |

## frontmatter フィールド定義

| フィールド | 型 | 付与方法 | 説明 |
|-----------|-----|---------|------|
| `title` | string | 自動（# 見出しから） | ドキュメントタイトル |
| `category` | string | 自動（パスから） | 大分類 |
| `subcategory` | string | 自動（パスから） | 小分類 |
| `url` | string | 自動（otoko のみ） | 出典URL |
| `date` | string | LLM抽出 + 人間レビュー | 情報の日付（YYYY-MM-DD） |
| `date_type` | string | LLM判定 | exact / estimated / observed / evergreen |
| `contact` | string | LLM抽出 | 問い合わせ先の課名 |

## date_type の定義

| date_type | 意味 | date の値 | エージェントの振る舞い |
|-----------|------|-----------|---------------------|
| `exact` | 本文・ファイル名に明示的な日付 | 明示的日付 | 年度を明示して回答 |
| `estimated` | 間接的手がかりから推測 | 推測日付 | 「〜と思われます」とヘッジ |
| `observed` | 変動リスクあり、掲載確認日 | スクレイピング日 | 最新情報は直接確認を促す |
| `evergreen` | 日付に依存しない恒久情報 | なし | ヘッジなしで回答 |

## カテゴリマッピング

### villotoinep/（音威子府村公式サイト）

| category | 対応ディレクトリ |
|----------|---------------|
| 住民生活 | `kurashi/` |
| 行政 | `gyousei/` |
| 施設案内 | `shisetsu/` |
| 産業 | `sangyou/` |
| 防災 | `bousai/` |
| ライフイベント | `lifeevent/` |
| 村長の部屋 | `village_mayor/` |
| 村の概要 | `about/` |
| 各課案内 | `kakuka/`（subcategory で課名を区別） |
| 資料 | `pdf/` |

### otoko/（おといねっぷ美術工芸高等学校）

全ファイル `category: 教育`。subcategory でディレクトリを区別。

| subcategory | 対応ディレクトリ |
|-------------|---------------|
| 入試 | `entrance/` |
| イベント | `event/` |
| 学校便り | `gakkoudayori/` |
| ギャラリー | `gallery/` |
| 中学生向け | `junior/` |
| 寮 | `ryou/` |
| 学校生活 | `seikatsu/` |
| 問合せ | `contact/` |

## extract の2パス構成

### Pass 1: date + contact 抽出（全ファイル）
- 機械的抽出（LLM スキップ）:
  - otoko/ タイムスタンプファイル名（`YYYY-MMDD-HHMM-SS.md`）
  - 広報誌ファイル名（`YYYY-MM.md`）
  - frontmatter url 内のタイムスタンプ
- LLM 抽出（Gemini Flash Lite）:
  - 本文から date + contact を抽出
  - 間接推測（年度表記、シーズン情報等）も対応

### Pass 2: evergreen vs observed 判定（date=null のファイルのみ）
- 専用プロンプトで「1年後に変わっている可能性があるか」を判定
- 電話番号・料金・時間・期限を含む → observed
- 歴史的事実・制度概念・リンク集 → evergreen

## review のフロー

要レビューファイルを1件ずつ確認する:

1. `code -r {ファイルパス}` でエディタにファイルを開く
2. AskUserQuestion で判定:
   - 承認（候補の日付で frontmatter に記録）
   - observed に変更（日付不明として扱い、スクレイピング日を付与）
   - 日付を修正して承認
3. 次のファイルへ

## 中間ファイル（review/）

| ファイル | 内容 |
|---------|------|
| `date-contact-candidates.tsv` | 全件の抽出結果 |
| `date-contact-auto-applied.tsv` | high 判定（自動適用可） |
| `date-contact-needs-review.tsv` | medium/low 判定（要レビュー） |

※ review/ は .gitignore 対象

## 典型的な運用フロー

```
1. np:syncKnowledge        ← dataset → knowledge 同期
2. np:frontmatter add      ← title/category/url 付与
3. np:frontmatter extract  ← LLM で date/contact 抽出
4. np:frontmatter review   ← 要レビューを人間確認
5. np:frontmatter apply    ← 結果を frontmatter に書き込み
6. np:uploadKnowledge      ← R2/Vectorize にアップロード
```
