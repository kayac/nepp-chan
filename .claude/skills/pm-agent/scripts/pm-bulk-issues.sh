#!/bin/bash
# pm-bulk-issues.sh - Bulk issue creation with checkpoint
# Usage: pm-bulk-issues.sh <issues.json> [--repo owner/repo] [--milestone N] [--dry-run]
#
# Creates multiple GitHub Issues from a JSON file.
# Features:
#   - Checkpoint for error recovery (idempotent)
#   - Dry-run mode for preview
#   - Batch processing with rate limit protection
#   - Milestone assignment via REST API

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pm-utils.sh"

# Load security utilities (required)
SECURITY_UTILS="${SCRIPT_DIR}/../../../scripts/security-utils.sh"
# shellcheck source=../../../scripts/security-utils.sh
source "$SECURITY_UTILS" || {
  echo "Error: security-utils.sh not found" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage: $0 <issues.json> [options]

Options:
  --repo <owner/repo>    Repository (default: auto-detect)
  --milestone <N>        Milestone number to assign
  --dry-run              Preview without creating issues
  --checkpoint <file>    Checkpoint file path (default: /tmp/claude/pm-checkpoint.json)
  --batch-size <N>       Issues per batch (default: 20)
  --delay <sec>          Delay between batches (default: 1)
  -h, --help             Show this help

Input JSON format:
[
  {"title": "Task name", "body": "Description", "type": "task", "labels": ["other-label"]}
]

Type handling (context-aware):
  - Organization repos: "type" field sets Issue Type via API
  - Personal repos: "type" field becomes "type:<value>" label
  - Labels in "labels" array are always applied
EOF
  exit 1
}

# Default values
ISSUES_FILE=""
REPO=""
MILESTONE=""
DRY_RUN=false
BATCH_SIZE=20
DELAY_SEC=1
CHECKPOINT_FILE="/tmp/claude/pm-checkpoint.json"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --milestone)
      MILESTONE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --checkpoint)
      CHECKPOINT_FILE="$2"
      shift 2
      ;;
    --batch-size)
      BATCH_SIZE="$2"
      shift 2
      ;;
    --delay)
      DELAY_SEC="$2"
      shift 2
      ;;
    -h | --help) usage ;;
    -*)
      echo "Unknown option: $1"
      usage
      ;;
    *)
      ISSUES_FILE="$1"
      shift
      ;;
  esac
done

# Validate input
[[ -z "$ISSUES_FILE" ]] && {
  echo "Error: issues.json is required"
  usage
}
[[ ! -f "$ISSUES_FILE" ]] && {
  echo "Error: File not found: $ISSUES_FILE"
  exit 1
}

# Get repository
REPO="${REPO:-$(get_repo)}"

# Ensure checkpoint directory exists
mkdir -p "$(dirname "$CHECKPOINT_FILE")"

echo "═══════════════════════════════════════════════"
echo "📋 pm-bulk-issues.sh"
echo "───────────────────────────────────────────────"
echo "  Repository: $REPO"

# Detect repository type
IS_ORG=false
if is_org_repo "$REPO"; then
  IS_ORG=true
  echo "  Type: 📋 Organization (Issue Types via API)"
else
  echo "  Type: 👤 Personal (type:* labels)"
fi
echo "═══════════════════════════════════════════════"
echo ""

[[ "$DRY_RUN" == true ]] && echo "🔍 DRY RUN MODE - no issues will be created"
echo ""

created_issues=()
skipped_count=0
count=0

while IFS= read -r issue; do
  # Extract values from JSON
  raw_title=$(echo "$issue" | jq -r '.title')
  raw_body=$(echo "$issue" | jq -r '.body // ""')
  issue_type=$(echo "$issue" | jq -r '.type // ""')
  raw_labels=$(echo "$issue" | jq -r '.labels // [] | join(",")')

  # Validate and sanitize inputs
  if [[ -z "$raw_title" ]] || [[ "$raw_title" == "null" ]]; then
    print_warn "Skipping issue with empty title"
    continue
  fi
  title=$(sanitize_string "$raw_title" 256)
  if [[ -z "$title" ]]; then
    print_warn "Skipping issue with invalid title"
    continue
  fi

  body=""
  if [[ -n "$raw_body" ]] && [[ "$raw_body" != "null" ]]; then
    body=$(sanitize_string "$raw_body" 65536)
  fi

  labels=""
  if [[ -n "$raw_labels" ]] && validate_labels "$raw_labels"; then
    labels="$raw_labels"
  elif [[ -n "$raw_labels" ]]; then
    print_warn "Invalid labels format, skipping labels"
  fi

  if [[ -n "$issue_type" ]] && ! validate_issue_type "$issue_type"; then
    print_warn "Invalid issue type: $issue_type"
    issue_type=""
  fi

  # Check checkpoint (idempotency)
  if is_already_created "$CHECKPOINT_FILE" "$title"; then
    print_skip "Skip (exists): $title"
    ((skipped_count++))
    continue
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "Would create: $title"
    [[ -n "$labels" ]] && echo "  └─ Labels: $labels"
    [[ -n "$MILESTONE" ]] && echo "  └─ Milestone: #$MILESTONE"
    continue
  fi

  # Build gh issue create arguments
  args=(--repo "$REPO" --title "$title")
  [[ -n "$body" ]] && args+=(--body "$body")

  # Handle type field based on repository type
  final_labels="$labels"
  if [[ -n "$issue_type" ]] && [[ "$IS_ORG" == false ]]; then
    # Personal repo: add type as label
    if [[ -n "$final_labels" ]]; then
      final_labels="type:$issue_type,$final_labels"
    else
      final_labels="type:$issue_type"
    fi
  fi
  [[ -n "$final_labels" ]] && args+=(--label "$final_labels")

  # Create issue
  if url=$(gh issue create "${args[@]}"); then
    number=$(extract_issue_number "$url")

    print_success "Created #$number: $title"
    created_issues+=("$number")

    # Save checkpoint
    save_checkpoint "$CHECKPOINT_FILE" "$number" "$title"

    # Set Issue Type for organization repos (via REST API)
    if [[ -n "$issue_type" ]] && [[ "$IS_ORG" == true ]]; then
      if set_issue_type "$REPO" "$number" "$issue_type" 2>/dev/null; then
        echo "   ↳ Issue Type: $issue_type"
      else
        print_warn "Failed to set Issue Type '$issue_type' for #$number"
      fi
    fi

    # Assign milestone if specified
    if [[ -n "$MILESTONE" ]]; then
      if assign_milestone "$REPO" "$number" "$MILESTONE" 2>/dev/null; then
        echo "   ↳ Assigned to milestone #$MILESTONE"
      else
        print_warn "Failed to assign milestone #$MILESTONE to #$number"
      fi
    fi
  else
    print_warn "Failed to create: $title"
  fi

  # Batch delay for rate limit protection
  ((count++))
  if ((count % BATCH_SIZE == 0)); then
    print_wait "Batch complete ($count issues), waiting ${DELAY_SEC}s..."
    sleep "$DELAY_SEC"
  fi
done < <(jq -c '.[]' "$ISSUES_FILE")

echo ""
echo "═══════════════════════════════════════════════"
echo "📊 Summary"
echo "───────────────────────────────────────────────"
if [[ "$DRY_RUN" == true ]]; then
  echo "  Mode: DRY RUN (no issues created)"
else
  echo "  Created: ${#created_issues[@]} issues"
  echo "  Skipped: $skipped_count issues"
  echo "  Checkpoint: $CHECKPOINT_FILE"
fi
echo "═══════════════════════════════════════════════"

# Output created issue numbers for downstream processing
if [[ ${#created_issues[@]} -gt 0 ]]; then
  echo ""
  print_info "Created issue numbers: ${created_issues[*]}"
fi
