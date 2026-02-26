# GitHub Projects 初期セットアップガイド

## 概要

GitHub Projects の初期セットアップを自動化するガイド。

## 前提条件

### 認証確認

```bash
# 認証状態確認
gh auth status

# project スコープが必要な場合
gh auth refresh -s project
```

### 必要なスコープ

- `repo`: Issue作成・編集
- `project`: Projects操作

## リポジトリタイプの判定

pm-agentは組織リポジトリと個人リポジトリで動作が異なります。

```bash
# リポジトリオーナーが組織かどうかを判定
REPO="owner/repo"
OWNER="${REPO%%/*}"
OWNER_TYPE=$(gh api "users/$OWNER" --jq '.type' 2>/dev/null)

if [[ "$OWNER_TYPE" == "Organization" ]]; then
  echo "📋 組織リポジトリ"
else
  echo "👤 個人リポジトリ"
fi
```

| Repository Type | type分類 | priority |
|-----------------|----------|----------|
| 組織 | Issue Types（GitHub組み込み） | Projects V2 Field |
| 個人 | type:*ラベル | Projects V2 Field |

**注意**: priorityは両方ともラベルではなくProjects V2 Fieldで管理します。

## セットアップフロー

### Step 1: 対象確認

```bash
# 個人のProjects一覧
gh project list --owner @me

# 組織のProjects一覧
gh project list --owner ORGANIZATION_NAME
```

### Step 2: カスタムフィールド作成

#### Type フィールド

**組織リポジトリの場合:**
- Projects V2の「Type」フィールドは自動的にIssue Typesと連携
- 組織設定（Settings > Planning > Issue types）でカスタムタイプを追加可能
- Typeフィールドを手動で作成する必要なし

**個人リポジトリの場合:**
- Projects V2に「Type」フィールドを作成することは可能だが、ラベルとの同期が煩雑
- **推奨**: type:*ラベルを使用し、Projects V2ではStatusとPriorityフィールドを活用

#### Priority フィールド（必須）

**両方のリポジトリタイプで推奨:**
priority:*ラベルは使用せず、Projects V2のPriorityフィールドで一元管理します。

```graphql
mutation {
  createProjectV2Field(input: {
    projectId: "PROJECT_ID"
    dataType: SINGLE_SELECT
    name: "Priority"
    singleSelectOptions: [
      {name: "High", color: RED, description: "最優先"}
      {name: "Medium", color: YELLOW, description: "通常"}
      {name: "Low", color: GREEN, description: "低優先度"}
    ]
  }) {
    projectV2Field {
      ... on ProjectV2SingleSelectField {
        id
        name
      }
    }
  }
}
```

#### Effort フィールド（Number）

```graphql
mutation {
  createProjectV2Field(input: {
    projectId: "PROJECT_ID"
    dataType: NUMBER
    name: "Effort"
  }) {
    projectV2Field {
      ... on ProjectV2Field {
        id
        name
      }
    }
  }
}
```

### Step 3: Iteration フィールド作成

**注意**: Iteration フィールドは GraphQL API でのみ作成可能

```graphql
mutation {
  createProjectV2Field(input: {
    projectId: "PROJECT_ID"
    dataType: ITERATION
    name: "Sprint"
  }) {
    projectV2Field {
      ... on ProjectV2IterationField {
        id
        name
        configuration {
          duration
          startDay
        }
      }
    }
  }
}
```

### Step 4: ビュー作成

#### Kanban ビュー（開発者向け）

```graphql
mutation {
  createProjectV2View(input: {
    projectId: "PROJECT_ID"
    name: "Kanban - Dev"
    layout: BOARD_LAYOUT
  }) {
    projectV2View {
      id
      name
    }
  }
}
```

#### Roadmap ビュー（経営層向け）

```graphql
mutation {
  createProjectV2View(input: {
    projectId: "PROJECT_ID"
    name: "Roadmap - Exec"
    layout: ROADMAP_LAYOUT
  }) {
    projectV2View {
      id
      name
    }
  }
}
```

#### Table ビュー（PM向け）

```graphql
mutation {
  createProjectV2View(input: {
    projectId: "PROJECT_ID"
    name: "Table - PM"
    layout: TABLE_LAYOUT
  }) {
    projectV2View {
      id
      name
    }
  }
}
```

### Step 5: ラベル作成（コンテキスト適応型）

ラベル作成はリポジトリタイプによって異なります。
`pm-setup-labels.sh` スクリプトが自動判定して適切なラベルを作成します。

```bash
# 自動判定でラベル作成
.claude/skills/pm-agent/scripts/pm-setup-labels.sh owner/repo
```

#### 個人リポジトリの場合:
```bash
# Type ラベルのみ作成（priority:*は作成しない）
gh label create "type:epic" --color "5319E7" --description "マイルストーン"
gh label create "type:feature" --color "0052CC" --description "機能要件"
gh label create "type:story" --color "00875A" --description "ユーザーストーリー"
gh label create "type:task" --color "97A0AF" --description "実装タスク"
gh label create "type:bug" --color "D73A4A" --description "バグ修正"
```

#### 組織リポジトリの場合:
ラベルは作成しません。代わりに:
- **type**: GitHub Issue Types を使用（組織設定で管理）
- **priority**: Projects V2 Field を使用

### Step 5b: Issue Types設定（組織リポジトリのみ）

組織リポジトリでは Issue Types が利用可能です。

**設定場所**: Organization Settings > Planning > Issue types

**デフォルトタイプ**:
- task
- bug
- feature

**カスタムタイプの追加**:
最大25個のカスタムタイプを追加可能（例: epic, story）

**確認コマンド**:
```bash
# 組織のIssue Typesを確認
gh api "orgs/ORGANIZATION/issue-types" --jq '.[].name'
```

## 実行例

### セットアップコマンド実行（個人リポジトリ）

```
@vw-pm-agent 初期設定して

PMAgent: GitHub Projectsの初期セットアップを開始します。

📍 対象: @me のProjects
📍 リポジトリタイプ: 👤 個人

作成するカスタムフィールド（Projects V2）:
- Priority: High / Medium / Low
- Effort: 時間（数値）
- Sprint: 2週間イテレーション

作成する推奨ビュー:
- Kanban（開発者向け）
- Roadmap（経営層向け）
- Table（PM向け）

作成するラベル:
- type:* (5種類)

⚠️ priority:*ラベルは作成しません（Projects V2 Fieldで管理）

実行しますか？ [Yes / キャンセル]
```

### セットアップコマンド実行（組織リポジトリ）

```
@vw-pm-agent 初期設定して

PMAgent: GitHub Projectsの初期セットアップを開始します。

📍 対象: organization のProjects
📍 リポジトリタイプ: 📋 組織

Issue Types（組織設定で管理）:
→ Settings > Planning > Issue types
利用可能: task, bug, feature

作成するカスタムフィールド（Projects V2）:
- Priority: High / Medium / Low
- Effort: 時間（数値）
- Sprint: 2週間イテレーション

作成する推奨ビュー:
- Kanban（開発者向け）
- Roadmap（経営層向け）
- Table（PM向け）

⚠️ type:*ラベルは作成しません（Issue Typesで管理）
⚠️ priority:*ラベルは作成しません（Projects V2 Fieldで管理）

実行しますか？ [Yes / キャンセル]
```

## トラブルシューティング

### 認証エラー

```
エラー: HTTP 401: Bad credentials

解決:
1. gh auth status で確認
2. gh auth refresh -s project で再認証
```

### スコープ不足

```
エラー: Resource not accessible by integration

解決:
gh auth refresh -s repo,project
```

### レート制限

```
エラー: API rate limit exceeded

解決:
1. 待機後にリトライ
2. バッチサイズを削減（20件 → 10件）
```

### フィールド重複

```
エラー: Field already exists

解決:
1. 既存フィールドを確認
2. 既存フィールドを使用するか確認
```

## 確認コマンド

```bash
# プロジェクト詳細確認
gh project view PROJECT_NUMBER --owner @me

# フィールド一覧
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

## スクリプト連携

### 概要

pm-agentスキルには、Issue一括作成を堅牢に行うためのヘルパースクリプトが含まれています。
これらのスクリプトは、vw:pmコマンドから自動的に呼び出されます。

### スクリプト配置

```
.claude/skills/pm-agent/scripts/
├── pm-utils.sh           # 共通ユーティリティ（is_org_repo()含む）
├── pm-setup-labels.sh    # コンテキスト適応型ラベル作成
├── pm-bulk-issues.sh     # Issue一括作成（Issue Type自動対応）
├── pm-link-hierarchy.sh  # Sub-issue関係設定
└── pm-project-fields.sh  # Projects V2フィールド設定（--bulk対応）
```

### 実行順序

Issue作成時は以下の順序でスクリプトを実行します:

```
1. pm-setup-labels.sh     # ラベル準備（個人リポジトリのみ）
       ↓
2. pm-bulk-issues.sh      # Issue一括作成（type自動対応）
       ↓
3. pm-link-hierarchy.sh   # 階層関係設定
       ↓
4. pm-project-fields.sh   # Projects V2フィールド設定（オプション）
```

### 統合ワークフロー例

```bash
# Step 1: リポジトリ確認（git remote origin から取得）
REPO=$(git remote get-url origin | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')

# Step 2: ラベル準備（個人リポジトリの場合のみ実行）
# 組織リポジトリではスキップされ、Issue Typesの案内が表示される
.claude/skills/pm-agent/scripts/pm-setup-labels.sh "$REPO"

# Step 3: Milestone作成（期限必須）
MILESTONE=$(gh api "repos/$REPO/milestones" \
  -X POST \
  -f title="Sprint 1" \
  -f due_on="2025-01-31T00:00:00Z" \
  --jq '.number')

# Step 4: issues.json作成（type フィールドを使用）
cat > /tmp/claude/issues.json << 'EOF'
[
  {"title": "⚙️ タスク1", "body": "...", "type": "task"},
  {"title": "⚙️ タスク2", "body": "...", "type": "task"},
  {"title": "📋 ストーリー", "body": "...", "type": "story"}
]
EOF

# Step 5: Issue一括作成（ドライラン→本実行）
# type フィールドは自動的に:
# - 組織リポジトリ: Issue Type として設定
# - 個人リポジトリ: type:* ラベルとして設定
.claude/skills/pm-agent/scripts/pm-bulk-issues.sh /tmp/claude/issues.json \
  --repo "$REPO" \
  --milestone "$MILESTONE" \
  --dry-run

.claude/skills/pm-agent/scripts/pm-bulk-issues.sh /tmp/claude/issues.json \
  --repo "$REPO" \
  --milestone "$MILESTONE"

# Step 6: 階層関係設定
.claude/skills/pm-agent/scripts/pm-link-hierarchy.sh /tmp/claude/hierarchy.json \
  --repo "$REPO"

# Step 7: Projects V2フィールド一括設定（オプション）
cat > /tmp/claude/fields.json << 'EOF'
[
  {"issue": 7, "status": "Todo", "priority": "High", "estimate": 2},
  {"issue": 8, "status": "Todo", "priority": "Medium", "estimate": 3}
]
EOF

.claude/skills/pm-agent/scripts/pm-project-fields.sh \
  --bulk /tmp/claude/fields.json \
  --project 1 --owner @me
```

### チェックポイント機能

`pm-bulk-issues.sh` はチェックポイント機能を持ち、途中失敗時に再開可能です:

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

### Sub-issue階層について

GitHub REST APIの Sub-issues エンドポイントを使用して階層関係を設定します。
これにより、GitHub Projects で「Parent issue」「Sub-issue progress」フィールドが利用可能になります。

参照: https://docs.github.com/en/rest/issues/sub-issues
