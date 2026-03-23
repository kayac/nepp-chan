# Sync リファレンス - dataset → knowledge 同期

## ディレクトリ構造

```
dataset/
├── v1/src/          ← 初期データセット
├── v3/src/          ← v3 データセット
├── v4/src/          ← v4 データセット（現在最新）
│   ├── villotoinep/ ← 音威子府村公式サイトデータ
│   ├── otoko/       ← 音威子府高校データ
│   └── welcome-guide.md
└── ...

knowledge/           ← RAG 用ナレッジ（dataset の src をミラー）
```

`dataset/<version>/src/` の内容が `knowledge/` にミラーリングされる。
`knowledge/` は R2 アップロードの入力元であり、常に dataset の最新バージョンと一致しているべき。

## 同期コマンド

```bash
# dry-run（差分プレビュー）
rsync -rcn --delete --itemize-changes dataset/<version>/src/ knowledge/

# 実行
rsync -rc --delete dataset/<version>/src/ knowledge/
```

### rsync オプション

| オプション | 説明 |
|-----------|------|
| `-r` | 再帰 |
| `-c` | チェックサムベース（タイムスタンプ無視、内容のみで判定） |
| `--delete` | knowledge 側にあって src 側にないファイルを削除 |
| `--itemize-changes` | 変更内容を詳細表示 |

### rsync itemize の読み方

| パターン | 意味 |
|---------|------|
| `>f+++++++++` | 新規ファイル |
| `>f.s......` or `>fc.......` | 内容変更 |
| `*deleting` | 削除 |
| `.f..T.....` | タイムスタンプのみ差分（`-c` 使用時は無視） |

## ワークフロー

### Step 1: バージョン検出

引数にバージョンが指定されている場合はそれを使用。
指定されていない場合は `dataset/` 配下のディレクトリを一覧し、AskUserQuestion で確認。

### Step 2: dry-run で差分プレビュー

結果を解析して以下のサマリーを表示:

```markdown
## 同期プレビュー: dataset/<version>/src/ → knowledge/

| 種別 | 件数 |
|------|:----:|
| 新規追加 | N |
| 更新 | N |
| 削除 | N |
| 変更なし | ✓ |
```

### Step 3: ユーザー確認 → 実行

差分がある場合のみ AskUserQuestion で確認後、rsync 実行。

### Step 4: 結果報告

```markdown
## 同期完了

- **同期元**: dataset/<version>/src/
- **同期先**: knowledge/
- **ファイル数**: N 件
- **次のステップ**: `np:frontmatter add` で frontmatter 付与、または `np:uploadKnowledge` で R2 にアップロード
```

## 制約

- `--delete` は必須だが、必ず dry-run → 確認 → 実行の順で行う
- 差分がない場合は「同期不要」と報告して終了
- dataset 側のファイルは読み取り専用として扱う
