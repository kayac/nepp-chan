# Frontmatter リファレンス - frontmatter 付与・抽出・レビュー・適用

## フィールド定義

```yaml
---
title: ごみカレンダー
category: 住民生活
subcategory: ごみ・環境
url: https://www.vill.otoineppu.hokkaido.jp/kurashi/gomi_kankyou/gomi_calendar.html
date: '2025-04-01'
date_type: exact
contact: 住民課 住民生活室 生活環境係
---
```

| フィールド | 型 | 付与方法 | 説明 |
|-----------|-----|---------|------|
| `title` | string | 自動（# 見出しから） | ドキュメントタイトル |
| `category` | string | 自動（パスから） | 大分類 |
| `subcategory` | string | 自動（パスから） | 小分類 |
| `url` | string | 自動（otoko のみ） | 出典URL（villotoinep は成功率50%のため省略） |
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

### observed と evergreen の判定基準

**observed（1年後に変わっている可能性がある）:**
- 営業時間、開館時間、定休日
- 料金、金額、費用
- 電話番号、FAX番号
- 担当課名、窓口案内
- 募集要項、応募条件
- 具体的な手続きの手順や期限

**evergreen（1年後も変わらない）:**
- ページの目次・リンク集
- 歴史的事実、地理情報
- 制度の仕組みの概念説明（金額を含まない）
- 文化施設・自然の歴史的背景

## カテゴリマッピング

### villotoinep/（音威子府村公式サイト）

| category | 対応ディレクトリ | 説明 |
|----------|---------------|------|
| 住民生活 | `kurashi/` | 住民向け生活情報・手続き |
| 行政 | `gyousei/` | 行財政・入札・計画 |
| 施設案内 | `shisetsu/` | 文化・スポーツ・医療施設 |
| 産業 | `sangyou/` | 農業・林業 |
| 防災 | `bousai/` | 防災計画・ハザードマップ |
| ライフイベント | `lifeevent/` | 妊娠〜おくやみ |
| お知らせ | `kakuka/*/oshirase/` | 各課からのお知らせ |
| 各課案内 | `kakuka/` | 各課の業務案内 |
| 村長の部屋 | `village_mayor/` | 村長挨拶・政策 |
| 村の概要 | `about/` | 村の概要・広報誌 |
| 資料 | `pdf/` | PDF変換ファイル |

### villotoinep/kurashi/ subcategory

| subcategory | 対応ディレクトリ |
|-------------|---------------|
| ごみ・環境 | `gomi_kankyou/` |
| 保険・年金 | `hoken_nenkin/` |
| 健康・福祉 | `kenkou_fukushi/` |
| 教育・学び | `manabi/` |
| 手続き | `tetsuduki/` |
| 税金 | `zeikin/` |

### villotoinep/kakuka/ subcategory

| subcategory | 対応ディレクトリ |
|-------------|---------------|
| 地域振興課 | `chiikishinkou/` |
| 駐在所 | `chutonjo/` |
| 議会事務局 | `gikaijimu/` |
| 保健福祉課 | `hokenfukushi/` |
| 住民生活課 | `juuminseikatsu/` |
| 環境整備課 | `kankyouseibi/` |
| 教育委員会 | `kyouikuiin/` |
| 農業委員会 | `nougyouiin/` |
| 産業振興課 | `sangyoushinkou/` |
| 選挙管理委員会 | `senkyokanri/` |
| 総務財政課 | `soumuzaisei/` |
| 出納室 | `suitoushitsu/` |
| 消防 | `syoubou/` |

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

## URL 推測ルール

| ソース | 推測ルール | 成功率 | 方針 |
|--------|-----------|:------:|------|
| otoko/ | `https://www.otoineppu-h.ed.jp/{path}/{filename}.html` | **100%** | 全件付与 |
| villotoinep/ | `https://www.vill.otoineppu.hokkaido.jp/{path}/{filename}.html` | **50%** | 付与しない |

villotoinep で成功するカテゴリ: `about/`, `kurashi/gomi_kankyou/`, `kakuka/`
villotoinep で失敗するカテゴリ: `kurashi/zeikin/`, `gyousei/`, `shisetsu/`（302→404）

## スクリプト

### add-frontmatter.ts

title/category/subcategory/url を一括付与。

```bash
pnpm frontmatter:add -- --dry-run                    # プレビュー
pnpm frontmatter:add                                  # knowledge/ に実行
pnpm frontmatter:add -- --target=dataset              # dataset にも実行
```

### extract-date-contact.ts

LLM 2パスで date/contact/date_type を抽出し TSV に出力。

```bash
pnpm frontmatter:extract -- --dry-run                 # 10件サンプル
pnpm frontmatter:extract                              # 全件実行（--target=dataset がデフォルト）
```

#### 2パス構成

**Pass 1（全ファイル）: date + contact 抽出**
- 機械的抽出（LLM スキップ）:
  - otoko/ タイムスタンプファイル名（`YYYY-MMDD-HHMM-SS.md`）→ exact
  - 広報誌ファイル名（`YYYY-MM.md`）→ exact
  - frontmatter url 内のタイムスタンプ → exact
- LLM 抽出（Gemini Flash Lite）:
  - 本文から date + contact を抽出
  - 間接推測（年度表記、シーズン情報等）も対応 → estimated

**Pass 2（date=null のファイルのみ）: evergreen vs observed 判定**
- 専用プロンプト: 「1年後に変わっている可能性があるか」
- 電話番号・料金・時間・期限を含む → observed
- 歴史的事実・制度概念・リンク集 → evergreen
- 迷ったら observed（安全側に倒す）

### apply-date-contact.ts

抽出結果を frontmatter に書き込み。

```bash
pnpm frontmatter:apply -- --dry-run                   # プレビュー
pnpm frontmatter:apply -- --target=both               # knowledge + dataset に実行
```

## 中間ファイル（review/）

| ファイル | 内容 |
|---------|------|
| `date-contact-candidates.tsv` | 全件の抽出結果 |
| `date-contact-auto-applied.tsv` | high 判定（自動適用可） |
| `date-contact-needs-review.tsv` | medium/low 判定（要レビュー） |

※ review/ は .gitignore 対象

## review ワークフロー

要レビューファイルを1件ずつ確認する:

1. `code -r {ファイルパス}` でエディタにファイルを開く
2. AskUserQuestion で判定:
   - 承認（候補の日付で frontmatter に記録）
   - observed に変更（日付不明として扱い、スクレイピング日を付与）
   - 日付を修正して承認
3. 次のファイルへ
4. 全件完了後、結果サマリーを表示

## サーバー側の実装

`server/src/services/knowledge/embedding.ts` で gray-matter パース + スプレッドが実装済み:

```typescript
const { data: frontmatter, content: body } = matter(content);
// ...
metadata: {
  ...frontmatter,  // ← frontmatter の全フィールドが各チャンクに含まれる
  source, title, section, subsection, content
}
```

**frontmatter を付与 → Vectorize 再同期するだけで、各チャンクのメタデータに自動反映される。**
