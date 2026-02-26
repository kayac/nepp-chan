#!/bin/bash
# pm-utils.sh - PM Agent Common Utilities
# Usage: source pm-utils.sh
#
# This file provides common functions for pm-agent scripts.
# All functions are designed to work with sandbox restrictions.

# Load security utilities (required)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECURITY_UTILS="${SCRIPT_DIR}/../../../scripts/security-utils.sh"
if [[ -f "$SECURITY_UTILS" ]]; then
  # shellcheck source=../../../scripts/security-utils.sh
  source "$SECURITY_UTILS"
fi

# Extract issue number from URL
# Input: https://github.com/owner/repo/issues/123
# Output: 123
extract_issue_number() {
  local url="$1"
  echo "$url" | grep -oE '[0-9]+$'
}

# Get repository name from git remote origin
# Priority: 1. argument, 2. git remote get-url origin
# Supports both SSH (git@github.com:owner/repo.git) and HTTPS formats
get_repo() {
  if [[ -n "${1:-}" ]]; then
    echo "$1"
    return
  fi

  local remote_url
  remote_url=$(git remote get-url origin 2>/dev/null) || {
    echo "Error: Could not get git remote origin. Specify --repo owner/repo" >&2
    exit 1
  }

  # Parse owner/repo from remote URL
  # SSH format: git@github.com:owner/repo.git
  # HTTPS format: https://github.com/owner/repo.git
  local repo
  if [[ "$remote_url" =~ ^git@github\.com:(.+)\.git$ ]]; then
    repo="${BASH_REMATCH[1]}"
  elif [[ "$remote_url" =~ ^https://github\.com/(.+)\.git$ ]]; then
    repo="${BASH_REMATCH[1]}"
  elif [[ "$remote_url" =~ ^https://github\.com/(.+)$ ]]; then
    repo="${BASH_REMATCH[1]}"
  else
    echo "Error: Unsupported remote URL format: $remote_url" >&2
    exit 1
  fi

  echo "$repo"
}

# Get repository owner from owner/repo format
get_repo_owner() {
  local repo="$1"
  echo "${repo%%/*}"
}

# Check if repository owner is an organization
# Returns 0 (true) for organization, 1 (false) for user
is_org_repo() {
  local repo="$1"
  local owner
  owner=$(get_repo_owner "$repo")

  local owner_type
  owner_type=$(gh api "users/$owner" --jq '.type' 2>/dev/null)

  [[ "$owner_type" == "Organization" ]]
}

# Get organization's issue types (if available)
# Returns list of issue type names, empty if not available
get_org_issue_types() {
  local org="$1"
  gh api "orgs/$org/issue-types" --jq '.[].name' 2>/dev/null || true
}

# Set issue type for an issue (organization repos only)
# Reference: https://docs.github.com/en/rest/issues
set_issue_type() {
  local repo="$1" issue_number="$2" issue_type="$3"

  validate_repo "$repo" || return 1
  validate_number "$issue_number" || return 1

  gh api "repos/$repo/issues/$issue_number" \
    -X PATCH \
    -f type="$issue_type" \
    --silent
}

# Create milestone (REST API)
# Note: due_on is required by pm-agent policy for deadline management
create_milestone() {
  local repo="$1" title="$2" due_on="$3"

  validate_repo "$repo" || return 1
  [[ -z "$due_on" ]] && {
    echo "Error: due_on is required (pm-agent policy)" >&2
    return 1
  }
  validate_date "$due_on" || return 1

  gh api "repos/$repo/milestones" \
    -X POST \
    -f title="$title" \
    -f due_on="$due_on" \
    --jq '.number'
}

# Get issue ID (numeric, not node_id)
# Required for sub-issue REST API
# Reference: https://docs.github.com/en/rest/issues/sub-issues
get_issue_id() {
  local repo="$1" issue_number="$2"

  validate_repo "$repo" || return 1
  validate_number "$issue_number" || return 1

  gh api "repos/$repo/issues/$issue_number" --jq '.id'
}

# Get parent issue number for a sub-issue
# Returns parent issue number if exists, empty string otherwise
# Reference: https://docs.github.com/en/rest/issues/sub-issues
get_parent_issue() {
  local repo="$1" issue_number="$2"
  gh api "repos/$repo/issues/$issue_number" --jq '.parent.number // empty' 2>/dev/null || echo ""
}

# Remove sub-issue relationship (REST API)
# Reference: https://docs.github.com/en/rest/issues/sub-issues#remove-sub-issue
remove_sub_issue() {
  local repo="$1" parent_number="$2" child_number="$3"

  # Get child issue ID (numeric integer)
  local child_id
  child_id=$(get_issue_id "$repo" "$child_number")

  # DELETE from sub_issues endpoint
  gh api "repos/$repo/issues/$parent_number/sub_issues/$child_id" \
    -X DELETE \
    -H "Accept: application/vnd.github+json"
}

# Add sub-issue relationship (REST API)
# Reference: https://docs.github.com/en/rest/issues/sub-issues
# Note: sub_issue_id must be sent as integer, not string
add_sub_issue() {
  local repo="$1" parent_number="$2" child_number="$3"

  validate_repo "$repo" || return 1
  validate_number "$parent_number" || return 1
  validate_number "$child_number" || return 1

  local child_id
  child_id=$(get_issue_id "$repo" "$child_number")

  if ! [[ "$child_id" =~ ^[0-9]+$ ]]; then
    echo "Error: Invalid issue ID for #$child_number" >&2
    return 1
  fi

  # POST to sub_issues endpoint
  # Use -F (not -f) to send sub_issue_id as integer
  gh api "repos/$repo/issues/$parent_number/sub_issues" \
    -X POST \
    -H "Accept: application/vnd.github+json" \
    -F sub_issue_id="$child_id"
}

# Assign milestone to issue (REST API)
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

# Save checkpoint (for error recovery)
save_checkpoint() {
  local checkpoint_file="$1" number="$2" title="$3"
  if [[ ! -f "$checkpoint_file" ]]; then
    echo '{"created":[]}' >"$checkpoint_file"
  fi
  jq --arg n "$number" --arg t "$title" \
    '.created += [{"number": $n, "title": $t}]' "$checkpoint_file" >"${checkpoint_file}.tmp"
  mv "${checkpoint_file}.tmp" "$checkpoint_file"
}

# Check if issue already created (idempotency)
is_already_created() {
  local checkpoint_file="$1" title="$2"
  if [[ -f "$checkpoint_file" ]]; then
    jq -e --arg t "$title" '.created[] | select(.title == $t)' "$checkpoint_file" >/dev/null 2>&1
  else
    return 1
  fi
}

# Print colored message (to stderr, so they don't interfere with command substitution)
print_success() { echo "✅ $*" >&2; }
print_skip() { echo "⏭️ $*" >&2; }
print_warn() { echo "⚠️ $*" >&2; }
print_info() { echo "📝 $*" >&2; }
print_wait() { echo "⏳ $*" >&2; }

# ============================================================
# Sub-issue Traversal Functions
# ============================================================

# Get direct child issues with title
# Returns: JSON array of {number, title}
# Example: [{"number": 11, "title": "Feature A"}, ...]
get_child_issues() {
  local repo="$1" parent_number="$2"
  gh api "repos/$repo/issues/$parent_number/sub_issues" \
    --jq '[.[] | {number: .number, title: .title}]' 2>/dev/null || echo "[]"
}

# Get all descendants of an issue recursively (BFS)
# Returns: JSON array of {number, title, depth}
# Example: [{"number": 11, "title": "Feature A", "depth": 1}, ...]
get_all_descendants() {
  local repo="$1" parent_number="$2" max_depth="${3:-10}"

  local result="[]"
  local current_queue next_queue
  local current_depth=1

  # Initialize with direct children
  current_queue=$(gh api "repos/$repo/issues/$parent_number/sub_issues" \
    --jq '[.[] | {number: .number, title: .title}]' 2>/dev/null || echo "[]")

  while [[ $(echo "$current_queue" | jq 'length') -gt 0 ]] && [[ $current_depth -le $max_depth ]]; do
    next_queue="[]"

    # Process each item in current queue
    while IFS= read -r item; do
      [[ -z "$item" ]] && continue

      local num title
      num=$(echo "$item" | jq -r '.number')
      title=$(echo "$item" | jq -r '.title')

      # Add to result with depth
      result=$(echo "$result" | jq --argjson n "$num" --arg t "$title" --argjson d "$current_depth" \
        '. + [{number: $n, title: $t, depth: $d}]')

      # Get children for next level (if not at max depth)
      if [[ $current_depth -lt $max_depth ]]; then
        local children
        children=$(gh api "repos/$repo/issues/$num/sub_issues" \
          --jq '[.[] | {number: .number, title: .title}]' 2>/dev/null || echo "[]")
        next_queue=$(echo "[$next_queue, $children]" | jq -s 'add | add // []')
      fi
    done < <(echo "$current_queue" | jq -c '.[]')

    current_queue="$next_queue"
    ((current_depth++))
  done

  echo "$result"
}

# ============================================================
# GitHub Projects V2 GraphQL Functions
# ============================================================

# Get project ID for user or organization
# Usage: get_project_id "@me" 1  OR  get_project_id "org-name" 1
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
    # Try organization first
    query='query($login: String!, $number: Int!) {
      organization(login: $login) {
        projectV2(number: $number) {
          id
        }
      }
    }'
    result=$(gh api graphql -f login="$owner" -F number="$number" -f query="$query" --jq '.data.organization.projectV2.id' 2>/dev/null) || true

    if [[ -z "$result" || "$result" == "null" ]]; then
      # Try as user
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

# Get all fields including iteration configuration
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

# Get issue node ID (GraphQL ID)
get_issue_node_id() {
  local repo="$1" issue_number="$2"
  gh api "repos/$repo/issues/$issue_number" --jq '.node_id'
}

# Add issue to project, returns item ID
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

# Update iteration field value
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

# Find iteration field ID from project fields JSON
find_iteration_field_id() {
  local fields_json="$1"
  echo "$fields_json" | jq -r '.[] | select(.dataType == "ITERATION") | .id' | head -1
}

# Find iteration ID by title from project fields JSON
find_iteration_id_by_title() {
  local fields_json="$1" title="$2"
  echo "$fields_json" | jq -r --arg t "$title" '
    .[] | select(.dataType == "ITERATION") | .configuration.iterations[]? | select(.title == $t) | .id
  ' | head -1
}

# Get available iterations from project fields JSON
get_available_iterations() {
  local fields_json="$1"
  echo "$fields_json" | jq -r '.[] | select(.dataType == "ITERATION") | .configuration.iterations[]? | .title'
}

# Get issue's project item and its iteration value
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

  # Extract issue title
  local issue_title
  issue_title=$(echo "$result" | jq -r '.data.repository.issue.title // ""')

  # Find the project item for the specified project
  local iteration_info
  # Note: Using 'select(.iterationId)' instead of 'select(.iterationId != null)'
  # to avoid bash history expansion issues with '!' character
  # Note: Using 'jq -c' for compact output and array indexing to get first match
  iteration_info=$(echo "$result" | jq -c --argjson pn "$project_number" '
    [.data.repository.issue.projectItems.nodes[]
    | select(.project.number == $pn)
    | .fieldValues.nodes[]
    | select(.iterationId)
    | {iterationId: .iterationId, title: .title, fieldId: .field.id, itemId: ""}][0] // null
  ' 2>/dev/null)

  # Get the item ID separately
  local item_id
  item_id=$(echo "$result" | jq -r --argjson pn "$project_number" '
    [.data.repository.issue.projectItems.nodes[]
    | select(.project.number == $pn)
    | .id][0] // empty
  ' 2>/dev/null)

  if [[ -n "$iteration_info" && "$iteration_info" != "null" ]]; then
    # Add item_id to the result
    echo "$iteration_info" | jq -c --arg iid "$item_id" --arg it "$issue_title" '. + {itemId: $iid, issueTitle: $it}'
  else
    echo "{\"iterationId\": null, \"title\": null, \"fieldId\": null, \"itemId\": \"$item_id\", \"issueTitle\": \"$issue_title\"}"
  fi
}

# Get issue's project item ID (for updating fields)
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

  # Note: Using pipe to jq instead of --jq because we need --argjson for project_number
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
