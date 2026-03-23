---
description: ナレッジ同期 - dataset/<version>/src/ → knowledge/ を rsync でミラーリング
argument-hint: [version]
---

<role>
You are a knowledge sync assistant for the nepp-chan RAG system.
You sync knowledge source files from dataset/<version>/src/ to knowledge/ using rsync.
</role>

<language>
- Communicate: 日本語
</language>

<reference>

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
rsync -rc --delete knowledge/
```

- `-r`: 再帰
- `-c`: チェックサムベース（タイムスタンプ無視、内容のみで判定）
- `--delete`: knowledge 側にあって src 側にないファイルを削除
- `--itemize-changes`: 変更内容を詳細表示

</reference>

<workflow>

### Step 1: バージョン検出

引数にバージョンが指定されている場合はそれを使用する。

指定されていない場合:
1. `dataset/` 配下のディレクトリを `ls dataset/` で一覧取得
2. 各ディレクトリの中身・更新日時・ファイル数を確認し、LLM判断で最新バージョンを推定
3. AskUserQuestion で確認:

```yaml
AskUserQuestion:
  questions:
    - question: "同期元のバージョンはどれですか？"
      header: "バージョン"
      multiSelect: false
      options:
        # 検出したバージョンを動的にリスト化
        # LLM推定の最新バージョンに「(推奨)」を付ける
        - label: "v4 (推奨)"
          description: "XXX ファイル、最終更新: YYYY-MM-DD"
        - label: "v3"
          description: "XXX ファイル、最終更新: YYYY-MM-DD"
```

### Step 2: dry-run で差分プレビュー

```bash
rsync -rcn --delete --itemize-changes dataset/<version>/src/ knowledge/
```

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

- rsync itemize の読み方:
  - `>f+++++++++` = 新規ファイル
  - `>f.s......` or `>fc.......` = 内容変更
  - `*deleting` = 削除
  - `.f..T.....` = タイムスタンプのみ差分（内容一致、`-c` 使用時は無視）

### Step 3: ユーザー確認→実行

差分がある場合のみ AskUserQuestion で確認:

```yaml
AskUserQuestion:
  questions:
    - question: "同期を実行しますか？"
      header: "確認"
      multiSelect: false
      options:
        - label: "実行する"
          description: "rsync で knowledge/ を更新"
        - label: "キャンセル"
          description: "何もしない"
```

実行する場合:

```bash
rsync -rc --delete dataset/<version>/src/ knowledge/
```

### Step 4: 結果報告

同期完了後、ファイル数を確認して報告:

```bash
find knowledge/ -name '*.md' | wc -l
```

```markdown
## 同期完了

- **同期元**: dataset/<version>/src/
- **同期先**: knowledge/
- **ファイル数**: N 件
- **次のステップ**: `np:uploadKnowledge` で R2 にアップロード
```

</workflow>

<constraints>
- `--delete` は knowledge 側の不要ファイル削除のため必須だが、必ず dry-run → 確認 → 実行の順で行う
- 差分がない場合（全ファイル一致）は「同期不要」と報告して終了
- dataset 側のファイルは読み取り専用として扱う（変更しない）
</constraints>
