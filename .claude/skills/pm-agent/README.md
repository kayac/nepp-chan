# PM Agent Skill

GitHub Projects PM Agent - 議事録からタスク抽出・Issue化、Projects初期セットアップを行う Claude Code skill。

## Prerequisites

- [gh CLI](https://cli.github.com/) (GitHub CLI)
- [jq](https://jqlang.github.io/jq/) (JSON processor)
- `gh auth status` で認証済みであること（`project` スコープ必要）

## Installation

### 1. skill フォルダをコピー

```bash
cp -r .claude/skills/pm-agent /path/to/your-project/.claude/skills/pm-agent
chmod +x /path/to/your-project/.claude/skills/pm-agent/scripts/*.sh
```

### 2. `/np:pm` スラッシュコマンドを使う場合

```bash
mkdir -p /path/to/your-project/.claude/commands
cp .claude/commands/np:pm.md /path/to/your-project/.claude/commands/np:pm.md
```

## Quick Start

```bash
# Agent として呼び出し
@np-pm-agent 以下の議事録からタスクを作って
[議事録テキスト]

# Command として呼び出し
/np:pm 初期設定して

# スクリプト単体実行
.claude/skills/pm-agent/scripts/pm-bulk-issues.sh --help
```

## Structure

```
.claude/skills/pm-agent/
├── README.md           # このファイル
├── COMMAND.md          # Agent/Command 本体（SSoT）
├── PARSER.md           # 議事録パース詳細ロジック
├── SETUP.md            # セットアップ手順・トラブルシューティング
├── GRAPHQL.md          # GraphQL API リファレンス
└── scripts/
    ├── pm-security.sh              # セキュリティバリデーション
    ├── pm-utils.sh                 # 共通ユーティリティ
    ├── pm-setup-labels.sh          # ラベル作成
    ├── pm-bulk-issues.sh           # Issue 一括作成
    ├── pm-link-hierarchy.sh        # Sub-issue 階層設定
    ├── pm-project-fields.sh        # Projects V2 フィールド設定
    ├── pm-cascade-iteration.sh     # Iteration 親→子継承
    └── pm-distribute-iterations.sh # Iteration 分散配置
```

## Key Features

- **議事録 → タスク変換**: テキストを 4 層構造（Epic/Feature/Story/Task）に自動分類
- **GitHub Projects セットアップ**: カスタムフィールド・ビューを自動作成
- **Issue 一括作成**: チェックポイント付きの冪等なバッチ処理
- **Sub-issue 階層**: REST API で親子関係を自動設定
- **Iteration 管理**: 親→子の継承、複数 Sprint への分散配置
