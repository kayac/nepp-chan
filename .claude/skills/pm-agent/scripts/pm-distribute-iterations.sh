#!/bin/bash
# pm-distribute-iterations.sh - Distribute child issues across iterations
# Usage: pm-distribute-iterations.sh <parent_issue_number> [options]
#
# Distributes child issues (e.g., Features under an Epic) across multiple
# iterations, with optional cascading to descendants.
#
# Reference: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pm-utils.sh"

usage() {
  cat <<EOF
Usage: $0 <parent_issue_number> [options]

Distribute child issues across multiple iterations.

Options:
  --repo <owner/repo>        Repository (default: auto-detect from git remote)
  --project <number>         Project number (required)
  --owner <login>            Project owner (@me for user, or org name)
  --iterations <list>        Comma-separated iteration names (required)
                             Example: "Sprint 1,Sprint 2,Sprint 3"
  --order <issue_numbers>    Custom order of issues (comma-separated)
                             Example: "15,12,18,14,16,13"
  --cascade                  Also cascade iteration to descendants of each issue
  --list                     List child issues and exit (for planning)
  --dry-run                  Show what would be done without executing
  -h, --help                 Show this help

Examples:
  # List Features under Epic #10
  $0 10 --project 1 --owner @me --list

  # Distribute Features across 3 sprints
  $0 10 --project 1 --owner @me --iterations "Sprint 1,Sprint 2,Sprint 3"

  # Custom order with cascade
  $0 10 --project 1 --owner @me \\
    --iterations "Sprint 1,Sprint 2,Sprint 3" \\
    --order "15,12,18,14,16,13" \\
    --cascade
EOF
  exit 1
}

# Default values
PARENT_ISSUE=""
REPO=""
PROJECT_NUMBER=""
PROJECT_OWNER=""
ITERATIONS=""
CUSTOM_ORDER=""
CASCADE=false
LIST_ONLY=false
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --project)
      PROJECT_NUMBER="$2"
      shift 2
      ;;
    --owner)
      PROJECT_OWNER="$2"
      shift 2
      ;;
    --iterations)
      ITERATIONS="$2"
      shift 2
      ;;
    --order)
      CUSTOM_ORDER="$2"
      shift 2
      ;;
    --cascade)
      CASCADE=true
      shift
      ;;
    --list)
      LIST_ONLY=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h | --help) usage ;;
    -*)
      echo "Unknown option: $1"
      usage
      ;;
    *)
      PARENT_ISSUE="$1"
      shift
      ;;
  esac
done

# Validate required arguments
[[ -z "$PARENT_ISSUE" ]] && {
  echo "Error: parent_issue_number is required"
  usage
}
[[ -z "$PROJECT_NUMBER" ]] && {
  echo "Error: --project is required"
  usage
}
[[ -z "$PROJECT_OWNER" ]] && {
  echo "Error: --owner is required"
  usage
}

REPO="${REPO:-$(get_repo)}"

# Note: GraphQL functions are now in pm-utils.sh (DRY refactoring)
# Available: get_project_id, get_project_fields, get_issue_node_id,
#            add_issue_to_project, update_iteration_field, find_iteration_field_id,
#            find_iteration_id_by_title, get_available_iterations, get_issue_item_id,
#            get_child_issues, get_all_descendants

# ============================================================
# Main Execution
# ============================================================

echo ""
echo "═══════════════════════════════════════════════"
echo "📋 pm-distribute-iterations.sh"
echo "───────────────────────────────────────────────"
echo "  Repository: $REPO"
echo "  Project: #$PROJECT_NUMBER"
echo "  Parent: #$PARENT_ISSUE"
[[ "$CASCADE" == true ]] && echo "  Cascade: enabled"
[[ "$DRY_RUN" == true ]] && echo "  Mode: DRY RUN"
echo "═══════════════════════════════════════════════"
echo ""

# Step 1: Get project ID and fields
echo "Fetching project information..."
PROJECT_ID=$(get_project_id "$PROJECT_OWNER" "$PROJECT_NUMBER")

if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "null" ]]; then
  echo "Error: Could not find project #$PROJECT_NUMBER for owner $PROJECT_OWNER" >&2
  exit 1
fi

FIELDS_JSON=$(get_project_fields "$PROJECT_ID")
ITERATION_FIELD_ID=$(find_iteration_field_id "$FIELDS_JSON")

if [[ -z "$ITERATION_FIELD_ID" || "$ITERATION_FIELD_ID" == "null" ]]; then
  echo "Error: Project #$PROJECT_NUMBER does not have an Iteration field" >&2
  exit 1
fi

# Step 2: Get parent issue info
PARENT_TITLE=$(gh api "repos/$REPO/issues/$PARENT_ISSUE" --jq '.title' 2>/dev/null || echo "Unknown")
echo "  Parent: #$PARENT_ISSUE - $PARENT_TITLE"
echo ""

# Step 3: Get child issues
CHILDREN_JSON=$(get_child_issues "$REPO" "$PARENT_ISSUE")
CHILD_COUNT=$(echo "$CHILDREN_JSON" | jq 'length')

if [[ "$CHILD_COUNT" -eq 0 ]]; then
  echo "Error: No child issues found for #$PARENT_ISSUE" >&2
  exit 1
fi

echo "Found $CHILD_COUNT child issue(s):"
echo ""

# Display child issues
idx=1
while IFS= read -r item; do
  num=$(echo "$item" | jq -r '.number')
  title=$(echo "$item" | jq -r '.title')
  echo "  $idx. #$num - $title"
  ((idx++)) || true
done < <(echo "$CHILDREN_JSON" | jq -c 'sort_by(.number) | .[]')

echo ""

# List-only mode
if [[ "$LIST_ONLY" == true ]]; then
  echo "Use --order to specify custom order, e.g.:"
  echo "  --order \"$(echo "$CHILDREN_JSON" | jq -r '[.[].number] | join(",")')\""
  exit 0
fi

# Validate iterations
if [[ -z "$ITERATIONS" ]]; then
  echo "Error: --iterations is required" >&2
  echo ""
  echo "Available iterations:"
  get_available_iterations "$FIELDS_JSON" | while read -r iter; do
    echo "  - $iter"
  done
  exit 1
fi

# Parse iterations into array
IFS=',' read -ra ITERATION_NAMES <<<"$ITERATIONS"
ITERATION_COUNT=${#ITERATION_NAMES[@]}

echo "Distribution plan:"
echo "  $CHILD_COUNT issue(s) → $ITERATION_COUNT iteration(s)"
echo ""

# Build ordered list of issues
if [[ -n "$CUSTOM_ORDER" ]]; then
  IFS=',' read -ra ORDERED_ISSUES <<<"$CUSTOM_ORDER"
  echo "Using custom order: $CUSTOM_ORDER"
else
  # Default: sort by issue number
  # Note: Using while loop instead of mapfile for macOS bash 3.x compatibility
  ORDERED_ISSUES=()
  while IFS= read -r num; do
    ORDERED_ISSUES+=("$num")
  done < <(echo "$CHILDREN_JSON" | jq -r '.[].number' | sort -n)
  echo "Using default order (by issue number)"
fi

echo ""

# Calculate distribution
CHUNK_SIZE=$(((${#ORDERED_ISSUES[@]} + ITERATION_COUNT - 1) / ITERATION_COUNT))

# Validate iterations exist
for iter_name in "${ITERATION_NAMES[@]}"; do
  iter_name=$(echo "$iter_name" | xargs) # Trim whitespace
  iter_id=$(find_iteration_id_by_title "$FIELDS_JSON" "$iter_name")
  if [[ -z "$iter_id" || "$iter_id" == "null" ]]; then
    echo "Error: Iteration '$iter_name' not found in project" >&2
    echo ""
    echo "Available iterations:"
    get_available_iterations "$FIELDS_JSON" | while read -r iter; do
      echo "  - $iter"
    done
    exit 1
  fi
done

# Show distribution plan
echo "Distribution:"
for ((i = 0; i < ITERATION_COUNT; i++)); do
  iter_name=$(echo "${ITERATION_NAMES[$i]}" | xargs)
  start=$((i * CHUNK_SIZE))
  end=$((start + CHUNK_SIZE))
  if [[ $end -gt ${#ORDERED_ISSUES[@]} ]]; then
    end=${#ORDERED_ISSUES[@]}
  fi

  if [[ $start -lt ${#ORDERED_ISSUES[@]} ]]; then
    issues_in_iter=("${ORDERED_ISSUES[@]:$start:$((end - start))}")
    echo "  $iter_name: ${issues_in_iter[*]}"
  else
    echo "  $iter_name: (none)"
  fi
done

echo ""

# Dry run mode
if [[ "$DRY_RUN" == true ]]; then
  echo "DRY RUN - no changes made"
  exit 0
fi

# Execute distribution
echo "Executing distribution..."
echo ""

updated_count=0
cascade_count=0

for ((i = 0; i < ITERATION_COUNT; i++)); do
  iter_name=$(echo "${ITERATION_NAMES[$i]}" | xargs)
  iter_id=$(find_iteration_id_by_title "$FIELDS_JSON" "$iter_name")

  start=$((i * CHUNK_SIZE))
  end=$((start + CHUNK_SIZE))
  if [[ $end -gt ${#ORDERED_ISSUES[@]} ]]; then
    end=${#ORDERED_ISSUES[@]}
  fi

  for ((j = start; j < end; j++)); do
    issue_num="${ORDERED_ISSUES[$j]}"
    issue_title=$(echo "$CHILDREN_JSON" | jq -r --argjson n "$issue_num" '.[] | select(.number == $n) | .title')

    # Ensure issue is in project and update iteration
    if ensure_and_update_iteration "$REPO" "$issue_num" "$PROJECT_ID" "$PROJECT_NUMBER" "$ITERATION_FIELD_ID" "$iter_id"; then
      print_success "#$issue_num: $issue_title → $iter_name"
      ((updated_count++)) || true
    else
      print_warn "Failed to set iteration for #$issue_num"
      continue
    fi

    # Cascade to descendants if enabled
    if [[ "$CASCADE" == true ]]; then
      descendants=$(get_all_descendants "$REPO" "$issue_num" 10)
      desc_count=$(echo "$descendants" | jq 'length')

      if [[ "$desc_count" -gt 0 ]]; then
        while IFS= read -r desc; do
          [[ -z "$desc" ]] && continue

          desc_num=$(echo "$desc" | jq -r '.number')
          desc_title=$(echo "$desc" | jq -r '.title')

          if ensure_and_update_iteration "$REPO" "$desc_num" "$PROJECT_ID" "$PROJECT_NUMBER" "$ITERATION_FIELD_ID" "$iter_id"; then
            echo "    └── #$desc_num: $desc_title → $iter_name"
            ((cascade_count++)) || true
          fi
        done < <(echo "$descendants" | jq -c '.[]')
      fi
    fi
  done
done

# Summary
echo ""
echo "═══════════════════════════════════════════════"
echo "📊 Summary"
echo "───────────────────────────────────────────────"
echo "  Parent: #$PARENT_ISSUE"
echo "  Issues distributed: $updated_count"
[[ "$CASCADE" == true ]] && echo "  Cascade updates: $cascade_count"
echo "  Iterations used: $ITERATION_COUNT"
echo "═══════════════════════════════════════════════"
