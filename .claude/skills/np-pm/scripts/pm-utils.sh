#!/bin/bash
# pm-utils.sh - PM Agent 共通ユーティリティ
# 使用方法: source pm-utils.sh
#
# pm-agent スクリプト用の共通関数を提供する。
# すべての関数はサンドボックス制限下で動作するように設計。

# セキュリティユーティリティの読み込み（スキル内にバンドル済み）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=pm-security.sh
source "$SCRIPT_DIR/pm-security.sh"

# URL から Issue 番号を抽出
# 入力: https://github.com/owner/repo/issues/123
# 出力: 123
extract_issue_number() {
  local url="$1"
  echo "$url" | grep -oE '[0-9]+$'
}

# git remote origin からリポジトリ名を取得
# 優先順位: 1. 引数, 2. git remote get-url origin
# SSH (git@github.com:owner/repo.git) と HTTPS 形式の両方に対応
get_repo() {
  if [[ -n "${1:-}" ]]; then
    echo "$1"
    return
  fi

  local remote_url
  remote_url=$(git remote get-url origin 2>/dev/null) || {
    echo "エラー: git remote origin を取得できません。--repo owner/repo を指定してください" >&2
    exit 1
  }

  # リモート URL から owner/repo をパース
  local repo
  if [[ "$remote_url" =~ ^git@github\.com:(.+)\.git$ ]]; then
    repo="${BASH_REMATCH[1]}"
  elif [[ "$remote_url" =~ ^https://github\.com/(.+)\.git$ ]]; then
    repo="${BASH_REMATCH[1]}"
  elif [[ "$remote_url" =~ ^https://github\.com/(.+)$ ]]; then
    repo="${BASH_REMATCH[1]}"
  else
    echo "エラー: 非対応のリモート URL 形式: $remote_url" >&2
    exit 1
  fi

  echo "$repo"
}

# owner/repo 形式からリポジトリオーナーを取得
get_repo_owner() {
  local repo="$1"
  echo "${repo%%/*}"
}

# リポジトリオーナーが組織かどうかを判定
# 組織なら 0 (true)、ユーザーなら 1 (false) を返す
is_org_repo() {
  local repo="$1"
  local owner
  owner=$(get_repo_owner "$repo")

  local owner_type
  owner_type=$(gh api "users/$owner" --jq '.type' 2>/dev/null)

  [[ "$owner_type" == "Organization" ]]
}

# 組織の Issue Types を取得（利用可能な場合）
# Issue Type 名のリストを返す。利用不可の場合は空
get_org_issue_types() {
  local org="$1"
  gh api "orgs/$org/issue-types" --jq '.[].name' 2>/dev/null || true
}

# Issue に Issue Type を設定（組織リポジトリのみ）
# 参考: https://docs.github.com/en/rest/issues
set_issue_type() {
  local repo="$1" issue_number="$2" issue_type="$3"

  validate_repo "$repo" || return 1
  validate_number "$issue_number" || return 1

  gh api "repos/$repo/issues/$issue_number" \
    -X PATCH \
    -f type="$issue_type" \
    --silent
}

# マイルストーンを作成（REST API）
# 注意: due_on は pm-agent のポリシーにより必須（期限管理のため）
create_milestone() {
  local repo="$1" title="$2" due_on="$3"

  validate_repo "$repo" || return 1
  [[ -z "$due_on" ]] && {
    echo "エラー: due_on は必須です（pm-agent ポリシー）" >&2
    return 1
  }
  validate_date "$due_on" || return 1

  gh api "repos/$repo/milestones" \
    -X POST \
    -f title="$title" \
    -f due_on="$due_on" \
    --jq '.number'
}

# Issue ID を取得（数値、node_id ではない）
# Sub-issue REST API に必要
# 参考: https://docs.github.com/en/rest/issues/sub-issues
get_issue_id() {
  local repo="$1" issue_number="$2"

  validate_repo "$repo" || return 1
  validate_number "$issue_number" || return 1

  gh api "repos/$repo/issues/$issue_number" --jq '.id'
}

# Sub-issue の親 Issue 番号を取得
# 親が存在すれば番号を返し、なければ空文字列を返す
# 参考: https://docs.github.com/en/rest/issues/sub-issues
get_parent_issue() {
  local repo="$1" issue_number="$2"
  gh api "repos/$repo/issues/$issue_number" --jq '.parent.number // empty' 2>/dev/null || echo ""
}

# Sub-issue 関係を削除（REST API）
# 参考: https://docs.github.com/en/rest/issues/sub-issues#remove-sub-issue
remove_sub_issue() {
  local repo="$1" parent_number="$2" child_number="$3"

  # 子 Issue ID を取得（数値整数）
  local child_id
  child_id=$(get_issue_id "$repo" "$child_number")

  gh api "repos/$repo/issues/$parent_number/sub_issues/$child_id" \
    -X DELETE \
    -H "Accept: application/vnd.github+json"
}

# Sub-issue 関係を追加（REST API）
# 参考: https://docs.github.com/en/rest/issues/sub-issues
# 注意: sub_issue_id は文字列ではなく整数として送信する必要がある
add_sub_issue() {
  local repo="$1" parent_number="$2" child_number="$3"

  validate_repo "$repo" || return 1
  validate_number "$parent_number" || return 1
  validate_number "$child_number" || return 1

  local child_id
  child_id=$(get_issue_id "$repo" "$child_number")

  if ! [[ "$child_id" =~ ^[0-9]+$ ]]; then
    echo "エラー: #$child_number の Issue ID が無効です" >&2
    return 1
  fi

  # sub_issue_id を整数として送信するため -F（-f ではなく）を使用
  gh api "repos/$repo/issues/$parent_number/sub_issues" \
    -X POST \
    -H "Accept: application/vnd.github+json" \
    -F sub_issue_id="$child_id"
}

# Issue にマイルストーンを割り当て（REST API）
assign_milestone() {
  local repo="$1" issue_number="$2" milestone_number="$3"

  validate_repo "$repo" || return 1
  validate_number "$issue_number" || return 1
  validate_number "$milestone_number" || return 1

  gh api "repos/$repo/issues/$issue_number" \
    -X PATCH \
    -F milestone="$milestone_number" \
    --silent
}

# チェックポイント保存（エラーリカバリー用）
save_checkpoint() {
  local checkpoint_file="$1" number="$2" title="$3"
  if [[ ! -f "$checkpoint_file" ]]; then
    echo '{"created":[]}' >"$checkpoint_file"
  fi
  jq --arg n "$number" --arg t "$title" \
    '.created += [{"number": $n, "title": $t}]' "$checkpoint_file" >"${checkpoint_file}.tmp"
  mv "${checkpoint_file}.tmp" "$checkpoint_file"
}

# Issue が作成済みかチェック（冪等性）
is_already_created() {
  local checkpoint_file="$1" title="$2"
  if [[ -f "$checkpoint_file" ]]; then
    jq -e --arg t "$title" '.created[] | select(.title == $t)' "$checkpoint_file" >/dev/null 2>&1
  else
    return 1
  fi
}

# メッセージ表示（コマンド置換と干渉しないよう stderr に出力）
print_success() { echo "✅ $*" >&2; }
print_skip() { echo "⏭️ $*" >&2; }
print_warn() { echo "⚠️ $*" >&2; }
print_info() { echo "📝 $*" >&2; }
print_wait() { echo "⏳ $*" >&2; }

# ============================================================
# Sub-issue 走査関数
# ============================================================

# 直接の子 Issue をタイトル付きで取得
# 戻り値: {number, title} の JSON 配列
get_child_issues() {
  local repo="$1" parent_number="$2"
  gh api "repos/$repo/issues/$parent_number/sub_issues" \
    --jq '[.[] | {number: .number, title: .title}]' 2>/dev/null || echo "[]"
}

# Issue の全子孫を再帰的に取得（BFS）
# 戻り値: {number, title, depth} の JSON 配列
get_all_descendants() {
  local repo="$1" parent_number="$2" max_depth="${3:-10}"

  local result="[]"
  local current_queue next_queue
  local current_depth=1

  # 直接の子で初期化
  current_queue=$(gh api "repos/$repo/issues/$parent_number/sub_issues" \
    --jq '[.[] | {number: .number, title: .title}]' 2>/dev/null || echo "[]")

  while [[ $(echo "$current_queue" | jq 'length') -gt 0 ]] && [[ $current_depth -le $max_depth ]]; do
    next_queue="[]"

    # 現在のキュー内の各アイテムを処理
    while IFS= read -r item; do
      [[ -z "$item" ]] && continue

      local num title
      num=$(echo "$item" | jq -r '.number')
      title=$(echo "$item" | jq -r '.title')

      # depth 付きで結果に追加
      result=$(echo "$result" | jq --argjson n "$num" --arg t "$title" --argjson d "$current_depth" \
        '. + [{number: $n, title: $t, depth: $d}]')

      # 次の階層の子を取得（最大深度でなければ）
      if [[ $current_depth -lt $max_depth ]]; then
        local children
        children=$(gh api "repos/$repo/issues/$num/sub_issues" \
          --jq '[.[] | {number: .number, title: .title}]' 2>/dev/null || echo "[]")
        next_queue=$(echo "[$next_queue, $children]" | jq -s 'add | add // []')
      fi
    done < <(echo "$current_queue" | jq -c '.[]')

    current_queue="$next_queue"
    ((current_depth++)) || true
  done

  echo "$result"
}

# ============================================================
# GitHub Projects V2 GraphQL 関数
# ============================================================

# ユーザーまたは組織のプロジェクト ID を取得
# 使用方法: get_project_id "@me" 1  または  get_project_id "org-name" 1
get_project_id() {
  local owner="$1" number="$2"
  local query result

  if [[ "$owner" == "@me" ]]; then
    query='query($number: Int!) {
      viewer {
        projectV2(number: $number) {
          id
        }
      }
    }'
    result=$(gh api graphql -F number="$number" -f query="$query" --jq '.data.viewer.projectV2.id')
  else
    # まず組織として試行
    query='query($login: String!, $number: Int!) {
      organization(login: $login) {
        projectV2(number: $number) {
          id
        }
      }
    }'
    result=$(gh api graphql -f login="$owner" -F number="$number" -f query="$query" --jq '.data.organization.projectV2.id' 2>/dev/null) || true

    if [[ -z "$result" || "$result" == "null" ]]; then
      # ユーザーとして試行
      query='query($login: String!, $number: Int!) {
        user(login: $login) {
          projectV2(number: $number) {
            id
          }
        }
      }'
      result=$(gh api graphql -f login="$owner" -F number="$number" -f query="$query" --jq '.data.user.projectV2.id')
    fi
  fi

  echo "$result"
}

# Iteration 設定を含む全フィールドを取得
get_project_fields() {
  local project_id="$1"
  local query='query($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 50) {
          nodes {
            ... on ProjectV2Field {
              id
              name
              dataType
            }
            ... on ProjectV2IterationField {
              id
              name
              dataType
              configuration {
                iterations {
                  id
                  title
                  startDate
                }
              }
            }
            ... on ProjectV2SingleSelectField {
              id
              name
              dataType
              options {
                id
                name
              }
            }
          }
        }
      }
    }
  }'

  gh api graphql -f projectId="$project_id" -f query="$query" --jq '.data.node.fields.nodes'
}

# Issue のノード ID を取得（GraphQL ID）
get_issue_node_id() {
  local repo="$1" issue_number="$2"
  gh api "repos/$repo/issues/$issue_number" --jq '.node_id'
}

# Issue をプロジェクトに追加し、アイテム ID を返す
add_issue_to_project() {
  local project_id="$1" content_id="$2"
  local mutation='mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {
      projectId: $projectId
      contentId: $contentId
    }) {
      item {
        id
      }
    }
  }'

  gh api graphql -f projectId="$project_id" -f contentId="$content_id" -f query="$mutation" \
    --jq '.data.addProjectV2ItemById.item.id'
}

# Iteration フィールドの値を更新
update_iteration_field() {
  local project_id="$1" item_id="$2" field_id="$3" iteration_id="$4"
  local mutation='mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $iterationId: String!) {
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
  }'

  gh api graphql -f projectId="$project_id" -f itemId="$item_id" -f fieldId="$field_id" \
    -f iterationId="$iteration_id" -f query="$mutation" --jq '.data.updateProjectV2ItemFieldValue.projectV2Item.id'
}

# プロジェクトフィールド JSON から Iteration フィールド ID を検索
find_iteration_field_id() {
  local fields_json="$1"
  echo "$fields_json" | jq -r '.[] | select(.dataType == "ITERATION") | .id' | head -1
}

# プロジェクトフィールド JSON からタイトルで Iteration ID を検索
find_iteration_id_by_title() {
  local fields_json="$1" title="$2"
  echo "$fields_json" | jq -r --arg t "$title" '
    .[] | select(.dataType == "ITERATION") | .configuration.iterations[]? | select(.title == $t) | .id
  ' | head -1
}

# プロジェクトフィールド JSON から利用可能な Iteration を取得
get_available_iterations() {
  local fields_json="$1"
  echo "$fields_json" | jq -r '.[] | select(.dataType == "ITERATION") | .configuration.iterations[]? | .title'
}

# Issue のプロジェクトアイテムとその Iteration 値を取得
get_issue_iteration() {
  local repo="$1" issue_number="$2" project_number="$3"
  local owner="${repo%%/*}"
  local repo_name="${repo##*/}"

  local query='query($owner: String!, $repo: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        title
        projectItems(first: 10) {
          nodes {
            id
            project {
              id
              number
            }
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldIterationValue {
                  iterationId
                  title
                  field {
                    ... on ProjectV2IterationField {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }'

  local result
  result=$(gh api graphql \
    -f owner="$owner" \
    -f repo="$repo_name" \
    -F issueNumber="$issue_number" \
    -f query="$query")

  # Issue タイトルを抽出
  local issue_title
  issue_title=$(echo "$result" | jq -r '.data.repository.issue.title // ""')

  # 指定プロジェクトのアイテムを検索
  local iteration_info
  # 注意: bash のヒストリ展開問題を避けるため 'select(.iterationId != null)' ではなく
  # 'select(.iterationId)' を使用
  iteration_info=$(echo "$result" | jq -c --argjson pn "$project_number" '
    [.data.repository.issue.projectItems.nodes[]
    | select(.project.number == $pn)
    | .fieldValues.nodes[]
    | select(.iterationId)
    | {iterationId: .iterationId, title: .title, fieldId: .field.id, itemId: ""}][0] // null
  ' 2>/dev/null)

  # アイテム ID を別途取得
  local item_id
  item_id=$(echo "$result" | jq -r --argjson pn "$project_number" '
    [.data.repository.issue.projectItems.nodes[]
    | select(.project.number == $pn)
    | .id][0] // empty
  ' 2>/dev/null)

  if [[ -n "$iteration_info" && "$iteration_info" != "null" ]]; then
    echo "$iteration_info" | jq -c --arg iid "$item_id" --arg it "$issue_title" '. + {itemId: $iid, issueTitle: $it}'
  else
    echo "{\"iterationId\": null, \"title\": null, \"fieldId\": null, \"itemId\": \"$item_id\", \"issueTitle\": \"$issue_title\"}"
  fi
}

# ============================================================
# 高レベル Iteration ヘルパー
# ============================================================

# Issue がプロジェクトに追加済みであることを保証し、item_id を返す
# 使用方法: item_id=$(ensure_project_item "$repo" "$issue_number" "$project_id" "$project_number")
ensure_project_item() {
  local repo="$1" issue_number="$2" project_id="$3" project_number="$4"

  local item_id
  item_id=$(get_issue_item_id "$repo" "$issue_number" "$project_number")

  if [[ -z "$item_id" || "$item_id" == "null" ]]; then
    local node_id
    node_id=$(get_issue_node_id "$repo" "$issue_number")
    item_id=$(add_issue_to_project "$project_id" "$node_id")
  fi

  if [[ -z "$item_id" || "$item_id" == "null" ]]; then
    return 1
  fi

  echo "$item_id"
}

# Issue をプロジェクトに追加し、Iteration を更新
# 使用方法: ensure_and_update_iteration "$repo" "$issue_num" "$project_id" "$project_number" "$field_id" "$iteration_id"
ensure_and_update_iteration() {
  local repo="$1" issue_num="$2" project_id="$3" project_number="$4" field_id="$5" iteration_id="$6"

  local item_id
  item_id=$(ensure_project_item "$repo" "$issue_num" "$project_id" "$project_number") || return 1

  update_iteration_field "$project_id" "$item_id" "$field_id" "$iteration_id" >/dev/null 2>&1
}

# Issue のプロジェクトアイテム ID を取得（フィールド更新用）
get_issue_item_id() {
  local repo="$1" issue_number="$2" project_number="$3"
  local owner="${repo%%/*}"
  local repo_name="${repo##*/}"

  local query='query($owner: String!, $repo: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        projectItems(first: 10) {
          nodes {
            id
            project {
              number
            }
          }
        }
      }
    }
  }'

  # project_number に --argjson が必要なため、--jq ではなく jq にパイプ
  gh api graphql \
    -f owner="$owner" \
    -f repo="$repo_name" \
    -F issueNumber="$issue_number" \
    -f query="$query" 2>/dev/null | jq -r --argjson pn "$project_number" '
      [.data.repository.issue.projectItems.nodes[]
      | select(.project.number == $pn)
      | .id][0] // empty
    '
}
