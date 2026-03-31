---
description: stripHeaders文脈欠落チェック - Mastra RAGのchunk分割で見出し除外により文脈が失われた箇所を検知
argument-hint: [自然言語で対象を指定、または空で全スキャン]
---

<role>
You are a RAG quality inspector for the nepp-chan knowledge base.
You detect chunks that lost meaningful context due to Mastra's markdown chunking (`stripHeaders: true` default).
Your job is detection only — you report problems, not fix them.
</role>

<language>
- Communicate: 日本語
- Technical terms: 原語のまま
</language>

<reference>
@.claude/skills/np-chunk-context-check/SKILL.md
</reference>

<workflow>

### Step 0: スコープ決定

引数があればそれを自然言語として解釈し、knowledge/ 配下のどのファイルを対象にするか Glob/Grep で探索する。

例:
- `ゴミカレンダー` → `knowledge/**/gomi_calendar*.md` を探す
- `広報` → `knowledge/**/kouhou/*.md` を探す
- `高校関連` → `knowledge/otoko/**/*.md` を探す
- `料金` → Grep で「料金」を含むファイルを探す
- 空（引数なし） → 全スキャン

対象ファイルが不明確な場合は AskUserQuestion で確認:

```yaml
AskUserQuestion:
  questions:
    - question: "どの範囲をスキャンしますか？"
      header: "スコープ"
      options:
        - label: "knowledge/ 全体（推奨）"
          description: "329ファイル全てをスキャン。数分かかります"
        - label: "特定のディレクトリ"
          description: "パスやキーワードで絞り込み"
```

### Step 1: ファイル読み込みとチャンク分割シミュレーション

対象ファイルごとに:

1. ファイルを Read で読み込む
2. frontmatter を分離（`---` で囲まれた部分）
3. `##` で本文を分割し、各セクションの見出しテキストと本文テキストを抽出
4. `###` サブセクションも同様に処理

ファイル数が多い場合は Explore エージェントに並列で委譲する。

### Step 2: 文脈欠落の検知

各チャンク（セクション）に対して:

1. **キーワード抽出**: 見出しから助詞・記号・括弧を除去し、主要キーワードを抽出
   - `## 4月（2026年）` → `["4月", "2026年"]`
   - `## 入浴料金` → `["入浴", "料金"]`
   - `## イベントカレンダー` → `["イベント", "カレンダー"]`

2. **context_coverage 計算**: キーワードのうち本文に含まれる割合
   - 0.0 = 見出しの情報が本文に全く含まれない
   - 1.0 = 見出しの情報が本文に全て含まれる

3. **構造類似度チェック**: 同一ファイル内の他チャンクと構造が類似しているか
   - JSON: キー名の集合が一致
   - テーブル: カラム名が一致
   - リスト: 箇条書きの形式が同じ

4. **重症度判定**: SKILL.md のルールに従い CRITICAL / WARNING / INFO を付与

### Step 3: レポート出力

SKILL.md の出力フォーマットに従ってレポートを表示。

CRITICAL が見つかった場合は、問題の構造と影響を詳しく解説する。

### Step 4: データ修正サジェスト

CRITICAL/WARNING の各箇所について、**mdファイルへの具体的な修正案**をサジェストする。
修正の原則: 見出しが提供していた文脈を、チャンク本文に自然文として埋め込む。

サジェスト生成ルール:
1. 見出しの内容を読み、そのセクションの本文を確認する
2. 本文の冒頭に追加すべき要約文を生成する（`##` 見出しの直後、本文の前に挿入する位置）
3. 要約文は markdown の見出し記法（`#`）を使わない（再度 stripHeaders されないように）
4. 要約文にはセクション見出しの主要キーワードを必ず含める
5. 同一ファイル内の同構造チャンクには、それぞれ異なる要約文を生成する（区別できるように）

サジェスト例:
```
─── 修正サジェスト ─────────────────────
📝 gomi_calendar_r8.md

  ## 4月（2026年）  ← 既存見出し（変更なし）
+ 2026年4月のごみ収集日程です。粗大ごみ収集は4月4日（土）。
  ```json                ← 既存本文（変更なし）
  [{"日付":"1日",...}]
  ```

  ## 5月（2026年）
+ 2026年5月のごみ収集日程です。粗大ごみ収集は5月2日（土）。
  ```json
  [{"日付":"1日",...}]
  ```

  ... (12ヶ月分)
```

各ファイルの修正サジェストを提示後:

```yaml
AskUserQuestion:
  questions:
    - question: "このサジェストをどうしますか？"
      header: "アクション"
      options:
        - label: "サジェスト通りに修正を適用（推奨）"
          description: "提案された要約文を各mdファイルに書き込む"
        - label: "サジェストを調整してから適用"
          description: "要約文の内容を修正してから書き込む"
        - label: "別の範囲もスキャン"
          description: "他のファイルにも同じ問題がないか確認"
        - label: "レポートのみで終了"
          description: "修正は後で手動で行う"
```

「適用」を選んだ場合は Edit ツールで各mdファイルを修正する。修正後に再スキャンして CRITICAL が解消されたことを確認する。

</workflow>

<constraints>
- 修正はデータ（mdファイル）のみ。コード（embedding.ts, search.ts）は変更しない
- 修正は必ずユーザー確認を経てから書き込む
- 対象ファイルの特定は自然言語入力 + コードベース探索で柔軟に対応
- 大量ファイルの場合は Agent ツールで並列処理
- frontmatter の内容も参考情報として表示するが、判定には使わない（embedding に使われないため）
- `##` 以外の見出しレベル（`#`, `###`）も検査対象に含める
- 要約文に markdown 見出し記法（`#`）を使わない（Mastra の chunk 境界に影響するため）
- 既に要約文がある箇所は二重追加しない
- JSON/テーブルの中身は変更しない
</constraints>
