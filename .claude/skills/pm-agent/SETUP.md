# セットアップ・運用リファレンス

セットアップのワークフローは SKILL.md（フェーズ 3B）を参照。
このファイルはデフォルト設定、スクリプト詳細、トラブルシューティングのリファレンス。

## デフォルト設定

### GitHub Settings

| 設定 | デフォルト値 | 説明 |
|------|-------------|------|
| owner | `@me` | 個人の場合は `@me`、組織の場合は組織名 |
| project_number | `1` | `gh project list` で確認 |

### 粒度ルール

| ルール | 値 | 説明 |
|--------|-----|------|
| 実装タスク最大時間 | **3時間** | 超えたら分割提案 |
| 警告閾値 | 2時間 | 警告表示 |

### レート制限

| 設定 | 値 | 説明 |
|------|-----|------|
| バッチサイズ | 20件 | 一度に処理する最大Issue数 |
| 遅延 | 1000ms | バッチ間の待機時間 |
| リトライ | 3回 | 最大リトライ回数 |

## 前提条件

```bash
# 認証状態確認
gh auth status

# project スコープが必要な場合
gh auth refresh -s project
```

必要なスコープ: `repo`（Issue作成・編集）、`project`（Projects操作）

## GraphQL ミューテーション

フィールド作成・ビュー作成の GraphQL は `GRAPHQL.md` を参照。

## スクリプトリファレンス

### スクリプト一覧

| スクリプト | 用途 | 必須 |
|-----------|------|------|
| `pm-utils.sh` | 共通ユーティリティ（is_org_repo()含む） | - |
| `pm-security.sh` | セキュリティユーティリティ | - |
| `pm-setup-labels.sh` | コンテキスト適応型ラベル作成 | ✅ |
| `pm-bulk-issues.sh` | Issue一括作成（Issue Type自動対応） | ✅ |
| `pm-link-hierarchy.sh` | Sub-issue関係設定 | ✅ |
| `pm-project-fields.sh` | Projects V2フィールド設定（--bulk対応） | - |
| `pm-cascade-iteration.sh` | 親→子へのIteration自動継承（--recursive対応） | - |
| `pm-distribute-iterations.sh` | 子Issueを複数Iterationに分散配置 | - |

### スクリプト配置

```
.claude/skills/pm-agent/scripts/
├── pm-utils.sh               # 共通ユーティリティ（is_org_repo()含む）
├── pm-security.sh             # セキュリティユーティリティ
├── pm-setup-labels.sh         # コンテキスト適応型ラベル作成
├── pm-bulk-issues.sh          # Issue一括作成（Issue Type自動対応）
├── pm-link-hierarchy.sh       # Sub-issue関係設定
├── pm-project-fields.sh       # Projects V2フィールド設定（--bulk対応）
├── pm-cascade-iteration.sh    # 親→子へのIteration自動継承
└── pm-distribute-iterations.sh # 子Issueを複数Iterationに分散配置
```

### 実行順序

Issue作成時は以下の順序でスクリプトを実行:

```
1. pm-setup-labels.sh     # ラベル準備（個人リポジトリのみ）
       ↓
2. pm-bulk-issues.sh      # Issue一括作成（type自動対応）
       ↓
3. pm-link-hierarchy.sh   # 階層関係設定
       ↓
4. pm-project-fields.sh   # Projects V2フィールド設定
```

### 統合ワークフロー例

```bash
# Step 1: リポジトリ確認
REPO=$(git remote get-url origin | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')

# Step 2: ラベル準備（個人リポジトリの場合のみ実行）
.claude/skills/pm-agent/scripts/pm-setup-labels.sh "$REPO"

# Step 3: Milestone作成（期限必須）
MILESTONE=$(gh api "repos/$REPO/milestones" \
  -X POST \
  -f title="Sprint 1" \
  -f due_on="2025-01-31T00:00:00Z" \
  --jq '.number')

# Step 4: issues.json作成
cat > /tmp/claude/issues.json << 'EOF'
[
  {"title": "⚙️ タスク1", "body": "...", "type": "task"},
  {"title": "⚙️ タスク2", "body": "...", "type": "task"},
  {"title": "📋 ストーリー", "body": "...", "type": "story"}
]
EOF

# Step 5: Issue一括作成（ドライラン→本実行）
.claude/skills/pm-agent/scripts/pm-bulk-issues.sh /tmp/claude/issues.json \
  --repo "$REPO" --milestone "$MILESTONE" --dry-run

.claude/skills/pm-agent/scripts/pm-bulk-issues.sh /tmp/claude/issues.json \
  --repo "$REPO" --milestone "$MILESTONE"

# Step 6: 階層関係設定
.claude/skills/pm-agent/scripts/pm-link-hierarchy.sh /tmp/claude/hierarchy.json \
  --repo "$REPO"

# Step 7: Projects V2フィールド一括設定
cat > /tmp/claude/fields.json << 'EOF'
[
  {"issue": 7, "status": "Todo", "priority": "High", "estimate": 2},
  {"issue": 8, "status": "Todo", "priority": "Medium", "estimate": 3}
]
EOF

.claude/skills/pm-agent/scripts/pm-project-fields.sh \
  --bulk /tmp/claude/fields.json --project 1 --owner @me
```

### Iteration継承（親→子）

親IssueのIterationを子Issueに自動継承:

```bash
# 直接の子のみ
.claude/skills/pm-agent/scripts/pm-cascade-iteration.sh 10 \
  --project 1 --owner @me

# 全子孫に再帰的に適用（Epic → Feature → Story → Task）
.claude/skills/pm-agent/scripts/pm-cascade-iteration.sh 10 \
  --project 1 --owner @me --recursive
```

オプション: `--recursive`（全子孫）、`--max-depth <N>`（最大深度、デフォルト: 10）、`--dry-run`

### Iteration分散配置

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

オプション: `--iterations <list>`（必須）、`--order <numbers>`、`--cascade`、`--list`、`--dry-run`

### チェックポイント機能

`pm-bulk-issues.sh` はチェックポイント機能を持ち、途中失敗時に再開可能:

```bash
# デフォルトのチェックポイントファイル
/tmp/claude/pm-checkpoint.json

# カスタムチェックポイント
pm-bulk-issues.sh issues.json --checkpoint /tmp/claude/my-checkpoint.json
```

チェックポイントファイル形式:
```json
{
  "created": [
    {"number": "1", "title": "タスク1"},
    {"number": "2", "title": "タスク2"}
  ]
}
```

### Sub-issue 階層について

GitHub REST API の Sub-issues エンドポイントを使用して階層関係を設定する。
これにより、GitHub Projects で「Parent issue」「Sub-issue progress」フィールドが利用可能になる。

参照: https://docs.github.com/en/rest/issues/sub-issues

### 特徴

- **冪等性**: チェックポイント機能で何度実行しても安全
- **エラーリカバリー**: 途中失敗時にチェックポイントから再開可能
- **ドライラン**: `--dry-run` で事前確認
- **Sandbox対応**: `--repo` オプションで明示的にリポジトリ指定

## トラブルシューティング

| エラー | 原因 | 解決方法 |
|--------|------|----------|
| HTTP 401: Bad credentials | 認証切れ | `gh auth refresh -s project` |
| Resource not accessible | スコープ不足 | `gh auth refresh -s repo,project` |
| API rate limit exceeded | レート制限 | 待機後リトライ、バッチサイズ削減 |
| Field already exists | フィールド重複 | 既存フィールドを確認して使用 |

## 確認コマンド

```bash
# プロジェクト詳細確認
gh project view PROJECT_NUMBER --owner @me

# フィールド一覧（pm-project-fields.sh 使用推奨）
.claude/skills/pm-agent/scripts/pm-project-fields.sh \
  --project 1 --owner @me --list-fields

# フィールド一覧（GraphQL 直接）
gh api graphql -f query='
  query {
    user(login: "USERNAME") {
      projectV2(number: PROJECT_NUMBER) {
        fields(first: 20) {
          nodes {
            ... on ProjectV2Field {
              id
              name
            }
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
            ... on ProjectV2IterationField {
              id
              name
            }
          }
        }
      }
    }
  }
'
```
