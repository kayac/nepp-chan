#!/bin/bash
# pm-project-fields.sh - Update GitHub Projects custom field values
# Usage: pm-project-fields.sh <issue_number> [options]
#
# Adds an issue to a GitHub Project and updates custom field values.
# Uses GraphQL API for Projects V2.
#
# Reference: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pm-utils.sh"

usage() {
  cat <<EOF
Usage: $0 <issue_number> [options]
       $0 --bulk <json_file> [options]

Options:
  --repo <owner/repo>      Repository (default: auto-detect from git remote)
  --project <number>       Project number (required)
  --owner <login>          Project owner (@me for user, or org name)
  --status <value>         Set Status field
  --priority <value>       Set Priority field
  --size <value>           Set Size field
  --estimate <number>      Set Estimate field (number)
  --iteration <name>       Set Iteration field
  --start-date <YYYY-MM-DD>   Set Start date
  --target-date <YYYY-MM-DD>  Set Target date
  --bulk <json_file>       Bulk update from JSON file
  --list-fields            List available fields and options, then exit
  --dry-run                Show what would be done without executing
  -h, --help               Show this help

Examples:
  # List available fields
  $0 --project 1 --owner @me --list-fields

  # Add issue to project and set fields
  $0 123 --project 1 --owner @me --status "In Progress" --priority "High"

  # Set multiple fields
  $0 123 --project 1 --owner @me \\
    --status "Todo" --priority "Medium" --estimate 3 --start-date 2025-01-15

  # Bulk update from JSON file
  $0 --bulk issues-fields.json --project 1 --owner @me

Bulk JSON format:
[
  {"issue": 123, "status": "Todo", "priority": "High", "estimate": 3},
  {"issue": 124, "status": "In Progress", "priority": "Medium"}
]
EOF
  exit 1
}

# Default values
ISSUE_NUMBER=""
REPO=""
PROJECT_NUMBER=""
PROJECT_OWNER=""
STATUS_VALUE=""
PRIORITY_VALUE=""
SIZE_VALUE=""
ESTIMATE_VALUE=""
ITERATION_VALUE=""
START_DATE=""
TARGET_DATE=""
BULK_FILE=""
LIST_FIELDS=false
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
    --status)
      STATUS_VALUE="$2"
      shift 2
      ;;
    --priority)
      PRIORITY_VALUE="$2"
      shift 2
      ;;
    --size)
      SIZE_VALUE="$2"
      shift 2
      ;;
    --estimate)
      ESTIMATE_VALUE="$2"
      shift 2
      ;;
    --iteration)
      ITERATION_VALUE="$2"
      shift 2
      ;;
    --start-date)
      START_DATE="$2"
      shift 2
      ;;
    --target-date)
      TARGET_DATE="$2"
      shift 2
      ;;
    --bulk)
      BULK_FILE="$2"
      shift 2
      ;;
    --list-fields)
      LIST_FIELDS=true
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
      ISSUE_NUMBER="$1"
      shift
      ;;
  esac
done

# Validate required arguments
[[ -z "$PROJECT_NUMBER" ]] && {
  echo "Error: --project is required"
  usage
}
[[ -z "$PROJECT_OWNER" ]] && {
  echo "Error: --owner is required"
  usage
}

REPO="${REPO:-$(get_repo)}"

# Update a single select field
update_single_select_field() {
  local project_id="$1" item_id="$2" field_id="$3" option_id="$4"
  local mutation='mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
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
  }'

  gh api graphql -f projectId="$project_id" -f itemId="$item_id" -f fieldId="$field_id" \
    -f optionId="$option_id" -f query="$mutation" --jq '.data.updateProjectV2ItemFieldValue.projectV2Item.id'
}

# Update a number field
update_number_field() {
  local project_id="$1" item_id="$2" field_id="$3" value="$4"
  local mutation='mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Float!) {
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
  }'

  gh api graphql -f projectId="$project_id" -f itemId="$item_id" -f fieldId="$field_id" \
    -F value="$value" -f query="$mutation" --jq '.data.updateProjectV2ItemFieldValue.projectV2Item.id'
}

# Update a date field
update_date_field() {
  local project_id="$1" item_id="$2" field_id="$3" date_value="$4"
  local mutation='mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $date: Date!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: {
        date: $date
      }
    }) {
      projectV2Item {
        id
      }
    }
  }'

  gh api graphql -f projectId="$project_id" -f itemId="$item_id" -f fieldId="$field_id" \
    -f date="$date_value" -f query="$mutation" --jq '.data.updateProjectV2ItemFieldValue.projectV2Item.id'
}

# Find option ID by name
find_option_id() {
  local fields_json="$1" field_name="$2" option_name="$3"
  echo "$fields_json" | jq -r --arg fn "$field_name" --arg on "$option_name" '
    .[] | select(.name == $fn) | .options[]? | select(.name == $on) | .id
  '
}

# Find field ID by name
find_field_id() {
  local fields_json="$1" field_name="$2"
  echo "$fields_json" | jq -r --arg fn "$field_name" '.[] | select(.name == $fn) | .id'
}

# Find iteration ID by title
find_iteration_id() {
  local fields_json="$1" field_name="$2" iteration_title="$3"
  echo "$fields_json" | jq -r --arg fn "$field_name" --arg it "$iteration_title" '
    .[] | select(.name == $fn) | .configuration.iterations[]? | select(.title == $it) | .id
  '
}

# Main execution
echo "Fetching project information..."
PROJECT_ID=$(get_project_id "$PROJECT_OWNER" "$PROJECT_NUMBER")

if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "null" ]]; then
  echo "Error: Could not find project #$PROJECT_NUMBER for owner $PROJECT_OWNER" >&2
  exit 1
fi

echo "  Project ID: $PROJECT_ID"

# Get fields
FIELDS_JSON=$(get_project_fields "$PROJECT_ID")

# List fields mode
if [[ "$LIST_FIELDS" == true ]]; then
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "📋 Available Fields for Project #$PROJECT_NUMBER"
  echo "═══════════════════════════════════════════════"
  echo ""
  echo "$FIELDS_JSON" | jq -r '
    .[] |
    "Field: \(.name)\n  ID: \(.id)\n  Type: \(.dataType)" +
    (if .options then "\n  Options:\n" + (.options | map("    - \(.name) (\(.id))") | join("\n")) else "" end) +
    (if .configuration.iterations then "\n  Iterations:\n" + (.configuration.iterations | map("    - \(.title) (\(.id))") | join("\n")) else "" end) +
    "\n"
  '
  exit 0
fi

# Process a single issue with field updates
# Arguments: issue_number status priority size estimate iteration start_date target_date
process_issue() {
  local issue_num="$1"
  local p_status="$2"
  local p_priority="$3"
  local p_size="$4"
  local p_estimate="$5"
  local p_iteration="$6"
  local p_start="$7"
  local p_target="$8"

  local issue_node_id item_id field_id option_id iteration_id local_update_count=0

  # Get issue node ID
  issue_node_id=$(get_issue_node_id "$REPO" "$issue_num") || {
    print_warn "Failed to get node ID for #$issue_num"
    return 1
  }

  # Add issue to project
  item_id=$(add_issue_to_project "$PROJECT_ID" "$issue_node_id") || {
    print_warn "Failed to add #$issue_num to project"
    return 1
  }

  if [[ -z "$item_id" || "$item_id" == "null" ]]; then
    print_warn "Failed to add #$issue_num to project"
    return 1
  fi

  echo "  #$issue_num → Project (Item: ${item_id:0:20}...)"

  # Update Status
  if [[ -n "$p_status" ]]; then
    field_id=$(find_field_id "$FIELDS_JSON" "Status")
    option_id=$(find_option_id "$FIELDS_JSON" "Status" "$p_status")
    if [[ -n "$field_id" && -n "$option_id" ]]; then
      update_single_select_field "$PROJECT_ID" "$item_id" "$field_id" "$option_id" >/dev/null && {
        echo "    ↳ Status = $p_status"
        ((local_update_count++)) || true
      }
    fi
  fi

  # Update Priority
  if [[ -n "$p_priority" ]]; then
    field_id=$(find_field_id "$FIELDS_JSON" "Priority")
    option_id=$(find_option_id "$FIELDS_JSON" "Priority" "$p_priority")
    if [[ -n "$field_id" && -n "$option_id" ]]; then
      update_single_select_field "$PROJECT_ID" "$item_id" "$field_id" "$option_id" >/dev/null && {
        echo "    ↳ Priority = $p_priority"
        ((local_update_count++)) || true
      }
    fi
  fi

  # Update Size
  if [[ -n "$p_size" ]]; then
    field_id=$(find_field_id "$FIELDS_JSON" "Size")
    option_id=$(find_option_id "$FIELDS_JSON" "Size" "$p_size")
    if [[ -n "$field_id" && -n "$option_id" ]]; then
      update_single_select_field "$PROJECT_ID" "$item_id" "$field_id" "$option_id" >/dev/null && {
        echo "    ↳ Size = $p_size"
        ((local_update_count++)) || true
      }
    fi
  fi

  # Update Estimate
  if [[ -n "$p_estimate" ]]; then
    field_id=$(find_field_id "$FIELDS_JSON" "Estimate")
    if [[ -n "$field_id" ]]; then
      update_number_field "$PROJECT_ID" "$item_id" "$field_id" "$p_estimate" >/dev/null && {
        echo "    ↳ Estimate = $p_estimate"
        ((local_update_count++)) || true
      }
    fi
  fi

  # Update Iteration
  if [[ -n "$p_iteration" ]]; then
    field_id=$(find_field_id "$FIELDS_JSON" "Iteration")
    iteration_id=$(find_iteration_id "$FIELDS_JSON" "Iteration" "$p_iteration")
    if [[ -n "$field_id" && -n "$iteration_id" ]]; then
      update_iteration_field "$PROJECT_ID" "$item_id" "$field_id" "$iteration_id" >/dev/null && {
        echo "    ↳ Iteration = $p_iteration"
        ((local_update_count++)) || true
      }
    fi
  fi

  # Update Start date
  if [[ -n "$p_start" ]]; then
    field_id=$(find_field_id "$FIELDS_JSON" "Start date")
    if [[ -n "$field_id" ]]; then
      update_date_field "$PROJECT_ID" "$item_id" "$field_id" "$p_start" >/dev/null && {
        echo "    ↳ Start date = $p_start"
        ((local_update_count++)) || true
      }
    fi
  fi

  # Update Target date
  if [[ -n "$p_target" ]]; then
    field_id=$(find_field_id "$FIELDS_JSON" "Target date")
    if [[ -n "$field_id" ]]; then
      update_date_field "$PROJECT_ID" "$item_id" "$field_id" "$p_target" >/dev/null && {
        echo "    ↳ Target date = $p_target"
        ((local_update_count++)) || true
      }
    fi
  fi

  return 0
}

# Bulk mode
if [[ -n "$BULK_FILE" ]]; then
  [[ ! -f "$BULK_FILE" ]] && {
    echo "Error: Bulk file not found: $BULK_FILE"
    exit 1
  }

  echo ""
  echo "═══════════════════════════════════════════════"
  echo "📋 Bulk Update Mode"
  echo "───────────────────────────────────────────────"
  echo "  Repository: $REPO"
  echo "  Project: #$PROJECT_NUMBER"
  echo "  Input: $BULK_FILE"
  [[ "$DRY_RUN" == true ]] && echo "  Mode: DRY RUN"
  echo "═══════════════════════════════════════════════"
  echo ""

  total_count=$(jq 'length' "$BULK_FILE")
  success_count=0
  fail_count=0

  if [[ "$DRY_RUN" == true ]]; then
    echo "Would process $total_count issues:"
    jq -r '.[] | "  #\(.issue): status=\(.status // "-"), priority=\(.priority // "-"), estimate=\(.estimate // "-")"' "$BULK_FILE"
    exit 0
  fi

  while IFS= read -r entry; do
    issue_num=$(echo "$entry" | jq -r '.issue')
    status=$(echo "$entry" | jq -r '.status // ""')
    priority=$(echo "$entry" | jq -r '.priority // ""')
    size=$(echo "$entry" | jq -r '.size // ""')
    estimate=$(echo "$entry" | jq -r '.estimate // ""')
    iteration=$(echo "$entry" | jq -r '.iteration // ""')
    start_date=$(echo "$entry" | jq -r '.start_date // .startDate // ""')
    target_date=$(echo "$entry" | jq -r '.target_date // .targetDate // ""')

    if process_issue "$issue_num" "$status" "$priority" "$size" "$estimate" "$iteration" "$start_date" "$target_date"; then
      ((success_count++)) || true
    else
      ((fail_count++)) || true
    fi
  done < <(jq -c '.[]' "$BULK_FILE")

  echo ""
  echo "═══════════════════════════════════════════════"
  echo "📊 Bulk Update Summary"
  echo "───────────────────────────────────────────────"
  echo "  Total: $total_count"
  echo "  Success: $success_count"
  echo "  Failed: $fail_count"
  echo "═══════════════════════════════════════════════"
  exit 0
fi

# Single issue mode - Validate issue number
[[ -z "$ISSUE_NUMBER" ]] && {
  echo "Error: issue_number is required"
  usage
}

echo "  Repository: $REPO"
echo "  Issue: #$ISSUE_NUMBER"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo "🔍 DRY RUN MODE - no changes will be made"
  echo ""
  echo "Would perform:"
  echo "  1. Add issue #$ISSUE_NUMBER to project"
  [[ -n "$STATUS_VALUE" ]] && echo "  2. Set Status = $STATUS_VALUE"
  [[ -n "$PRIORITY_VALUE" ]] && echo "  3. Set Priority = $PRIORITY_VALUE"
  [[ -n "$SIZE_VALUE" ]] && echo "  4. Set Size = $SIZE_VALUE"
  [[ -n "$ESTIMATE_VALUE" ]] && echo "  5. Set Estimate = $ESTIMATE_VALUE"
  [[ -n "$ITERATION_VALUE" ]] && echo "  6. Set Iteration = $ITERATION_VALUE"
  [[ -n "$START_DATE" ]] && echo "  7. Set Start date = $START_DATE"
  [[ -n "$TARGET_DATE" ]] && echo "  8. Set Target date = $TARGET_DATE"
  exit 0
fi

if process_issue "$ISSUE_NUMBER" "$STATUS_VALUE" "$PRIORITY_VALUE" "$SIZE_VALUE" "$ESTIMATE_VALUE" "$ITERATION_VALUE" "$START_DATE" "$TARGET_DATE"; then
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "📊 Summary"
  echo "───────────────────────────────────────────────"
  echo "  Issue #$ISSUE_NUMBER added to project #$PROJECT_NUMBER"
  echo "═══════════════════════════════════════════════"
else
  echo ""
  echo "Error: Failed to process issue #$ISSUE_NUMBER" >&2
  exit 1
fi
