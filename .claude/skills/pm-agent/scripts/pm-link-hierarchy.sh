#!/bin/bash
# pm-link-hierarchy.sh - Set up sub-issue relationships
# Usage: pm-link-hierarchy.sh <hierarchy.json> [--repo owner/repo]
#
# Sets up parent-child (sub-issue) relationships between GitHub Issues.
# Uses the REST API: POST /repos/{owner}/{repo}/issues/{parent}/sub_issues
#
# Reference: https://docs.github.com/en/rest/issues/sub-issues

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pm-utils.sh"

usage() {
  cat <<EOF
Usage: $0 <hierarchy.json> [options]

Options:
  --repo <owner/repo>    Repository (default: auto-detect)
  --dry-run              Preview without setting relationships
  --force                Remove existing parent before setting new one
  --verbose              Show detailed error messages
  -h, --help             Show this help

Input JSON format:
[
  {"parent": 10, "children": [7, 8, 9]},
  {"parent": 11, "children": [10]}
]

Example hierarchy (bottom-up):
  Epic #12
  └── Feature #11
      └── Story #10
          ├── Task #7
          ├── Task #8
          └── Task #9

JSON for above:
[
  {"parent": 10, "children": [7, 8, 9]},
  {"parent": 11, "children": [10]},
  {"parent": 12, "children": [11]}
]

Behavior:
  Default: Skip issues that already have a parent (safe)
  --force: Remove existing parent and set new one (override)
EOF
  exit 1
}

# Default values
HIERARCHY_FILE=""
REPO=""
DRY_RUN=false
FORCE=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --verbose | -v)
      VERBOSE=true
      shift
      ;;
    -h | --help) usage ;;
    -*)
      echo "Unknown option: $1"
      usage
      ;;
    *)
      HIERARCHY_FILE="$1"
      shift
      ;;
  esac
done

# Validate input
[[ -z "$HIERARCHY_FILE" ]] && {
  echo "Error: hierarchy.json is required"
  usage
}
[[ ! -f "$HIERARCHY_FILE" ]] && {
  echo "Error: File not found: $HIERARCHY_FILE"
  exit 1
}

# Get repository
REPO="${REPO:-$(get_repo)}"

echo "Setting up issue hierarchy for $REPO..."
[[ "$DRY_RUN" == true ]] && echo "🔍 DRY RUN MODE - no relationships will be created"
[[ "$FORCE" == true ]] && echo "⚡ FORCE MODE - existing parents will be replaced"
echo ""

success_count=0
skip_count=0
fail_count=0

while IFS= read -r relation; do
  parent=$(echo "$relation" | jq -r '.parent')
  children=$(echo "$relation" | jq -r '.children[]')

  for child in $children; do
    # Check if child already has a parent
    existing_parent=$(get_parent_issue "$REPO" "$child")

    if [[ "$DRY_RUN" == true ]]; then
      if [[ -n "$existing_parent" ]]; then
        echo "Would link: #$parent ← #$child (has parent #$existing_parent)"
      else
        echo "Would link: #$parent ← #$child (sub-issue)"
      fi
      continue
    fi

    # Handle existing parent
    if [[ -n "$existing_parent" ]]; then
      if [[ "$existing_parent" == "$parent" ]]; then
        # Already linked to the same parent - skip
        print_skip "#$child already linked to #$parent"
        ((skip_count++))
        continue
      elif [[ "$FORCE" == true ]]; then
        # Remove existing parent and set new one
        print_info "Removing #$child from parent #$existing_parent..."
        if remove_sub_issue "$REPO" "$existing_parent" "$child" 2>/dev/null; then
          print_success "Removed #$child from #$existing_parent"
        else
          print_warn "Failed to remove #$child from #$existing_parent"
          ((fail_count++))
          continue
        fi
      else
        # Default: skip issues with existing parent
        print_skip "#$child (already has parent #$existing_parent)"
        ((skip_count++))
        continue
      fi
    fi

    # Set sub-issue relationship
    error_output=""
    if error_output=$(add_sub_issue "$REPO" "$parent" "$child" 2>&1); then
      print_success "#$parent ← #$child (sub-issue)"
      ((success_count++))
    else
      print_warn "Failed: #$parent ← #$child"
      if [[ "$VERBOSE" == true ]]; then
        echo "   └─ Error: $error_output" >&2
      fi
      ((fail_count++))
    fi
  done
done < <(jq -c '.[]' "$HIERARCHY_FILE")

echo ""
echo "═══════════════════════════════════════════════"
echo "📊 Summary"
echo "───────────────────────────────────────────────"
if [[ "$DRY_RUN" == true ]]; then
  echo "  Mode: DRY RUN (no relationships created)"
else
  echo "  Success: $success_count relationships"
  [[ $skip_count -gt 0 ]] && echo "  Skipped: $skip_count (use --force to override)"
  [[ $fail_count -gt 0 ]] && echo "  Failed: $fail_count relationships"
fi
echo "═══════════════════════════════════════════════"

# Tip for GitHub Projects
if [[ "$DRY_RUN" != true ]] && ((success_count > 0)); then
  echo ""
  print_info "Tip: Enable 'Parent issue' and 'Sub-issue progress' fields in GitHub Projects for visualization"
fi

# Exit with error only if there are actual failures (not skips)
if [[ $fail_count -gt 0 ]]; then
  if [[ "$VERBOSE" != true ]]; then
    echo ""
    print_info "Hint: Use --verbose to see detailed error messages"
  fi
  exit 1
fi
exit 0
