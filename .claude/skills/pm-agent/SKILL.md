---
name: pm-agent
description: GitHub Projects PM Agent skill. Converts meeting notes to structured tasks (Epic/Feature/Story/Task) and manages GitHub Projects setup. Key UX: "Throw messy meeting notes, get organized tasks."
---

# PM Agent Skill

## Overview

GitHub Projects PM（プロジェクトマネジメント）スキル。
議事録やメモから自動的にタスクを抽出し、GitHub Issues/Projectsに構造化して登録する。

**キラーUX**: 「雑に議事録を投げるとタスク化してくれる」

## When to Use

- 議事録からタスクを作成したい
- GitHub Projects の初期設定をしたい
- 既存Issueの整理・改善提案が欲しい
- プロジェクトの進捗レポートが欲しい

## Progressive Disclosure Structure

このスキルは Progressive Disclosure パターンを使用:

- **SKILL.md** (常に読み込み): 概要とエントリポイント
- **PARSER.md** (必要時): 議事録パース詳細ロジック
- **SETUP.md** (必要時): 初期セットアップ手順
- **GRAPHQL.md** (必要時): GraphQL API リファレンス

## Core Features

### 1. 議事録 → タスク変換（MVP）

```
入力: 議事録テキスト or ファイル参照
出力: 4層構造（Epic/Feature/Story/Task）の提案
```

### 2. Projects 初期セットアップ（MVP）

```
自動作成:
- カスタムフィールド（Type/Priority/Effort）
- Iterationフィールド（GraphQL API）
- 推奨ビュー（Kanban/Roadmap/Table）
```

### 3. 現状分析・改善提案（Phase 2）

```
分析対象:
- 既存Issueの分類
- ラベル整理
- 粒度不適切なチケット
```

## 4層チケット構造

| 層 | Type | 粒度 | 例 |
|----|------|------|-----|
| Epic | マイルストーン | 「v1.0正式リリース」 |
| Feature | 1-3スプリント | 「在庫管理機能搭載」 |
| Story | 1スプリント以内 | 「在庫管理ができるようになる」 |
| Task/Bug | 3時間以内 | 「DBスキーマ設計」 |

## Invocation

このスキルは `np-pm-agent` エージェントを通じて呼び出される。

```
@np-pm-agent [議事録テキスト or コマンド]
```

### コマンド例

```bash
# 議事録からタスク作成
@np-pm-agent 以下の議事録からタスクを作って
[議事録テキスト]

# ファイル参照
@np-pm-agent @path/to/meeting-notes.md からタスクを作って

# 初期セットアップ
@np-pm-agent 初期設定して

# 現状分析
@np-pm-agent 現状のIssue整理して
```

## Default Configuration

### GitHub Settings

| 設定 | デフォルト値 | 説明 |
|------|-------------|------|
| owner | `@me` | 個人の場合は `@me`、組織の場合は組織名 |
| project_number | `1` | `gh project list` で確認 |

### Custom Fields

| フィールド | 種類 | 選択肢 | カラー |
|-----------|------|--------|--------|
| **Type** | Single Select | Epic / Feature / Story / Task / Bug | purple / blue / green / gray / red |
| **Priority** | Single Select | High / Medium / Low | red / yellow / green |
| **Effort** | Number | - | - |

### Labels & Issue Types (Context-Aware)

pm-agentはリポジトリタイプに応じてtype分類方法を自動切り替えします。

| Repository Type | type分類 | priority |
|-----------------|----------|----------|
| **組織** | Issue Types（GitHub組み込み） | Projects V2 Field |
| **個人** | type:*ラベル（下記） | Projects V2 Field |

**個人リポジトリで作成されるラベル:**

| ラベル | カラーコード | 説明 |
|--------|-------------|------|
| `type:epic` | `5319E7` | マイルストーン |
| `type:feature` | `0052CC` | 機能要件 |
| `type:story` | `00875A` | ユーザーストーリー |
| `type:task` | `97A0AF` | 実装タスク |
| `type:bug` | `D73A4A` | バグ修正 |

**注意**: `priority:*`ラベルは作成されません（Projects V2 Fieldで管理）

**組織リポジトリのIssue Types:**

組織設定（Settings > Planning > Issue types）で管理:
- デフォルト: task, bug, feature
- カスタム: 最大25個追加可能

### Granularity Rules

| ルール | 値 | 説明 |
|--------|-----|------|
| 実装タスク最大時間 | **3時間** | 超えたら分割提案 |
| 警告閾値 | 2時間 | 警告表示 |

### Rate Limit Settings

| 設定 | 値 | 説明 |
|------|-----|------|
| バッチサイズ | 20件 | 一度に処理する最大Issue数 |
| 遅延 | 1000ms | バッチ間の待機時間 |
| リトライ | 3回 | 最大リトライ回数 |

### Recommended Views

| ビュー名 | タイプ | 対象 |
|---------|--------|------|
| Kanban - Dev | Board | 開発者向け（statusでグループ化） |
| Roadmap - Exec | Roadmap | 経営層向け（parentでグループ化） |
| Table - PM | Table | PM向け（priorityでソート） |

## Error Handling

| エラー | 対応 |
|--------|------|
| 認証エラー | `gh auth refresh -s project` を案内 |
| API失敗 | 操作を中断し `AskUserQuestion` でユーザーに確認 |
| レート制限 | バッチ処理（20件/回）、遅延挿入 |
| フィールド重複 | 既存フィールドを使用するか確認 |

## Rollback / Recovery

- **Issue作成失敗**: 作成済みのIssueを列挙し、手動削除を案内
- **セットアップ失敗**: 作成済みリソースを列挙し、部分的な再実行を提案
- **API障害**: 操作ログを表示し、後日再試行を案内

## Scripts

本スキルには実行可能なヘルパースクリプトが含まれる。

### スクリプト一覧

| スクリプト | 用途 | 必須 |
|-----------|------|------|
| `pm-utils.sh` | 共通ユーティリティ（is_org_repo()含む） | - |
| `pm-setup-labels.sh` | コンテキスト適応型ラベル作成 | ✅ |
| `pm-bulk-issues.sh` | Issue一括作成（Issue Type自動対応） | ✅ |
| `pm-link-hierarchy.sh` | Sub-issue関係設定 | ✅ |
| `pm-project-fields.sh` | Projects V2フィールド設定（--bulk対応） | - |
| `pm-cascade-iteration.sh` | 親→子へのIteration自動継承（--recursive対応） | - |
| `pm-distribute-iterations.sh` | 子Issueを複数Iterationに分散配置 | - |

### 使用方法

#### 1. ラベル一括作成（必須：Issue作成前に実行）

```bash
.claude/skills/pm-agent/scripts/pm-setup-labels.sh owner/repo
```

#### 2. Issue一括作成

入力JSON形式（typeフィールドを使用）:
```json
[
  {"title": "⚙️ タスク名", "body": "説明", "type": "task"},
  {"title": "📋 ストーリー名", "body": "## Related\n- #1", "type": "story"},
  {"title": "🎯 機能名", "body": "...", "type": "feature", "labels": ["other-label"]}
]
```

**Type handling（自動判定）:**
- 組織リポジトリ: Issue作成後、REST APIでIssue Typeを設定
- 個人リポジトリ: `type:{value}`形式でラベルとして付与

実行:
```bash
# ドライラン（確認）
.claude/skills/pm-agent/scripts/pm-bulk-issues.sh issues.json --repo owner/repo --dry-run

# 本実行（Milestone付き）
.claude/skills/pm-agent/scripts/pm-bulk-issues.sh issues.json --repo owner/repo --milestone 1
```

#### 3. Sub-issue階層設定

入力JSON形式:
```json
[
  {"parent": 10, "children": [7, 8, 9]},
  {"parent": 11, "children": [10]},
  {"parent": 12, "children": [11]}
]
```

実行:
```bash
.claude/skills/pm-agent/scripts/pm-link-hierarchy.sh hierarchy.json --repo owner/repo
```

#### 4. Projects V2フィールド設定

利用可能なフィールドを確認:
```bash
.claude/skills/pm-agent/scripts/pm-project-fields.sh \
  --project 1 --owner @me --list-fields
```

**単一Issue設定:**
```bash
.claude/skills/pm-agent/scripts/pm-project-fields.sh 123 \
  --project 1 --owner @me \
  --status "In Progress" --priority "High" --estimate 3
```

**一括設定（--bulk オプション）:**

入力JSON形式:
```json
[
  {"issue": 123, "status": "Todo", "priority": "High", "estimate": 3},
  {"issue": 124, "status": "In Progress", "priority": "Medium"}
]
```

実行:
```bash
.claude/skills/pm-agent/scripts/pm-project-fields.sh \
  --bulk /tmp/claude/fields.json \
  --project 1 --owner @me
```

**注意**: priorityはラベルではなくProjects V2 Fieldで管理します。

#### 5. Iteration継承（親→子）

親IssueのIterationを子Issueに自動継承:

```bash
# 直接の子のみ
.claude/skills/pm-agent/scripts/pm-cascade-iteration.sh 10 \
  --project 1 --owner @me

# 全子孫に再帰的に適用（Epic → Feature → Story → Task）
.claude/skills/pm-agent/scripts/pm-cascade-iteration.sh 10 \
  --project 1 --owner @me --recursive
```

**オプション**:
- `--recursive`: 全子孫に再帰的にIterationを適用
- `--max-depth <N>`: 再帰の最大深度（デフォルト: 10）
- `--dry-run`: 実行せずにプレビュー

**注意**: 親IssueにIterationが設定されている必要があります。

#### 6. Iteration分散配置

子Issue（Features等）を複数のIterationに分散配置:

```bash
# 子Issue一覧を確認
.claude/skills/pm-agent/scripts/pm-distribute-iterations.sh 10 \
  --project 1 --owner @me --list

# 3つのスプリントに分散配置
.claude/skills/pm-agent/scripts/pm-distribute-iterations.sh 10 \
  --project 1 --owner @me \
  --iterations "Sprint 1,Sprint 2,Sprint 3"

# カスタム順序で配置 + 子孫にもcascade
.claude/skills/pm-agent/scripts/pm-distribute-iterations.sh 10 \
  --project 1 --owner @me \
  --iterations "Sprint 1,Sprint 2,Sprint 3" \
  --order "15,12,18,14,16,13" \
  --cascade
```

**オプション**:
- `--iterations <list>`: カンマ区切りのIteration名（必須）
- `--order <numbers>`: Issue番号のカンマ区切りリスト（カスタム順序）
- `--cascade`: 各子Issueの子孫にも同じIterationを適用
- `--list`: 子Issue一覧を表示して終了（計画用）
- `--dry-run`: 実行せずにプレビュー

### 特徴

- **冪等性**: チェックポイント機能で何度実行しても安全
- **エラーリカバリー**: 途中失敗時にチェックポイントから再開可能
- **ドライラン**: `--dry-run` で事前確認
- **Sandbox対応**: `--repo` オプションで明示的にリポジトリ指定
- **GraphQL対応**: Projects V2 のカスタムフィールド更新をサポート
