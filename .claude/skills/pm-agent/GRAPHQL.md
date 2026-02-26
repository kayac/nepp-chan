# GraphQL API リファレンス

## 概要

GitHub Projects v2 は GraphQL API を通じて操作する。
gh CLI では対応できない操作（カスタムフィールド作成、Iteration設定など）に使用。

## 認証

```bash
# gh CLI 経由で GraphQL を実行
gh api graphql -f query='YOUR_QUERY'
```

## プロジェクト情報取得

### プロジェクトID取得（個人）

```graphql
query {
  user(login: "USERNAME") {
    projectV2(number: PROJECT_NUMBER) {
      id
      title
      url
    }
  }
}
```

### プロジェクトID取得（組織）

```graphql
query {
  organization(login: "ORG_NAME") {
    projectV2(number: PROJECT_NUMBER) {
      id
      title
      url
    }
  }
}
```

### フィールド一覧取得

```graphql
query {
  node(id: "PROJECT_ID") {
    ... on ProjectV2 {
      fields(first: 20) {
        nodes {
          ... on ProjectV2Field {
            id
            name
            dataType
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
              color
            }
          }
          ... on ProjectV2IterationField {
            id
            name
            configuration {
              duration
              startDay
              iterations {
                id
                title
                startDate
              }
            }
          }
        }
      }
    }
  }
}
```

## フィールド作成

### Single Select フィールド

```graphql
mutation CreateTypeField($projectId: ID!) {
  createProjectV2Field(input: {
    projectId: $projectId
    dataType: SINGLE_SELECT
    name: "Type"
    singleSelectOptions: [
      {name: "Epic", color: PURPLE, description: "マイルストーン・日付確定のゴール"}
      {name: "Feature", color: BLUE, description: "1-3スプリントで完了する機能要件"}
      {name: "Story", color: GREEN, description: "1スプリント以内で完了するユーザー価値"}
      {name: "Task", color: GRAY, description: "一度の作業で完了する実装タスク"}
      {name: "Bug", color: RED, description: "不具合修正"}
    ]
  }) {
    projectV2Field {
      ... on ProjectV2SingleSelectField {
        id
        name
        options {
          id
          name
        }
      }
    }
  }
}
```

### Number フィールド

```graphql
mutation CreateEffortField($projectId: ID!) {
  createProjectV2Field(input: {
    projectId: $projectId
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

### Iteration フィールド

```graphql
mutation CreateSprintField($projectId: ID!) {
  createProjectV2Field(input: {
    projectId: $projectId
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

## アイテム操作

### Issue をプロジェクトに追加

```graphql
mutation AddIssueToProject($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {
    projectId: $projectId
    contentId: $contentId
  }) {
    item {
      id
    }
  }
}
```

### フィールド値を更新（Single Select）

```graphql
mutation UpdateItemFieldValue(
  $projectId: ID!
  $itemId: ID!
  $fieldId: ID!
  $optionId: String!
) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: {
      singleSelectOptionId: $optionId
    }
  }) {
    projectV2Item {
      id
    }
  }
}
```

### フィールド値を更新（Number）

```graphql
mutation UpdateEffortValue(
  $projectId: ID!
  $itemId: ID!
  $fieldId: ID!
  $value: Float!
) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: {
      number: $value
    }
  }) {
    projectV2Item {
      id
    }
  }
}
```

### フィールド値を更新（Iteration）

```graphql
mutation UpdateSprintValue(
  $projectId: ID!
  $itemId: ID!
  $fieldId: ID!
  $iterationId: String!
) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: {
      iterationId: $iterationId
    }
  }) {
    projectV2Item {
      id
    }
  }
}
```

## ビュー操作

### ビュー作成

```graphql
mutation CreateView($projectId: ID!, $name: String!, $layout: ProjectV2ViewLayout!) {
  createProjectV2View(input: {
    projectId: $projectId
    name: $name
    layout: $layout
  }) {
    projectV2View {
      id
      name
      layout
    }
  }
}
```

レイアウトオプション:
- `TABLE_LAYOUT`: テーブル
- `BOARD_LAYOUT`: カンバン
- `ROADMAP_LAYOUT`: ロードマップ

## gh CLI での実行例

### 変数を使用した実行

```bash
gh api graphql -f query='
  mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {
      projectId: $projectId
      contentId: $contentId
    }) {
      item {
        id
      }
    }
  }
' -f projectId="PVT_xxx" -f contentId="I_xxx"
```

### クエリ結果の整形

```bash
gh api graphql -f query='...' --jq '.data.user.projectV2.fields.nodes[].name'
```

## エラーハンドリング

### 一般的なエラー

```json
{
  "errors": [
    {
      "type": "NOT_FOUND",
      "message": "Could not resolve to a ProjectV2"
    }
  ]
}
```

対処: プロジェクトID確認、権限確認

### レート制限

```json
{
  "errors": [
    {
      "type": "RATE_LIMITED",
      "message": "API rate limit exceeded"
    }
  ]
}
```

対処: 待機後リトライ、バッチサイズ削減

### フィールド重複

```json
{
  "errors": [
    {
      "type": "UNPROCESSABLE",
      "message": "Field already exists with name Type"
    }
  ]
}
```

対処: 既存フィールドを使用

## バッチ処理パターン

### 複数Issue追加

```bash
#!/bin/bash
# バッチでIssueをプロジェクトに追加

PROJECT_ID="PVT_xxx"
ISSUE_IDS=("I_xxx1" "I_xxx2" "I_xxx3")
BATCH_SIZE=20
DELAY_MS=1000

for ((i=0; i<${#ISSUE_IDS[@]}; i++)); do
  content_id="${ISSUE_IDS[$i]}"

  gh api graphql -f query='
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {
        projectId: $projectId
        contentId: $contentId
      }) {
        item { id }
      }
    }
  ' -f projectId="$PROJECT_ID" -f contentId="$content_id"

  # バッチ区切りで遅延
  if (( (i + 1) % BATCH_SIZE == 0 )); then
    sleep $((DELAY_MS / 1000))
  fi
done
```

## 便利なクエリ集

### プロジェクト全体の状態取得

```graphql
query GetProjectState($login: String!, $number: Int!) {
  user(login: $login) {
    projectV2(number: $number) {
      id
      title
      items(first: 100) {
        totalCount
        nodes {
          id
          content {
            ... on Issue {
              title
              number
              state
            }
          }
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                field { ... on ProjectV2Field { name } }
              }
            }
          }
        }
      }
    }
  }
}
```
