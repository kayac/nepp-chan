#!/bin/bash
# pm-security.sh - Security Validation Functions for PM Agent
#
# Bundled from .claude/scripts/security-utils.sh for skill portability.
# This file contains only the functions needed by pm-agent scripts.
#
# Usage: source pm-security.sh

set -euo pipefail

# ============================================================
# Input Sanitization
# ============================================================

# Sanitize string for safe shell usage (titles, labels, etc.)
# Removes shell metacharacters: $ ` ; | & ( ) { } [ ] < > \ " '
# Preserves: alphanumeric, space, newline, common punctuation
# Usage: safe=$(sanitize_string "$input" [max_length])
sanitize_string() {
  local input="$1"
  local max_length="${2:-4096}"

  [[ -z "$input" ]] && return 0

  if [[ ${#input} -gt $max_length ]]; then
    input="${input:0:$max_length}"
  fi

  printf '%s' "$input" | tr -cd '[:alnum:] _.,:/@#\n-'
}

# Sanitize Markdown content for Issue body
# Preserves Markdown formatting characters: ()[]{}*!~>+=|#_`$\n etc.
# Only removes ANSI escapes and null bytes
# Usage: safe_body=$(sanitize_markdown "$input" [max_length])
sanitize_markdown() {
  local input="$1"
  local max_length="${2:-65536}"

  [[ -z "$input" ]] && return 0

  if [[ ${#input} -gt $max_length ]]; then
    input="${input:0:$max_length}"
  fi

  # Remove ANSI escape sequences and null bytes, preserve all Markdown formatting
  printf '%s' "$input" | sed $'s/\x1b\\[[0-9;]*[a-zA-Z]//g' | tr -d '\000'
}

# ============================================================
# Input Validation
# ============================================================

# Validate GitHub repository format (owner/repo)
# Usage: validate_repo "owner/repo" && echo "valid"
validate_repo() {
  local repo="$1"
  [[ "$repo" =~ ^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$ ]]
}

# Validate positive integer
# Usage: validate_number "123" && echo "valid"
validate_number() {
  local num="$1"
  [[ "$num" =~ ^[0-9]+$ ]]
}

# Validate ISO8601 date (YYYY-MM-DD)
# Usage: validate_date "2025-12-28" && echo "valid"
validate_date() {
  local date="$1"
  [[ "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]
}

# Validate labels format (alphanumeric, dash, underscore, colon, comma)
# Usage: validate_labels "bug,priority:high" && echo "valid"
validate_labels() {
  local labels="$1"
  [[ -z "$labels" ]] && return 0
  [[ "$labels" =~ ^[a-zA-Z0-9_:,\ -]+$ ]]
}

# Validate issue type against allowed values
# Usage: validate_issue_type "task" && echo "valid"
validate_issue_type() {
  local type="$1"
  [[ -z "$type" ]] && return 0
  [[ "$type" =~ ^(task|bug|feature|epic|story|enhancement|documentation)$ ]]
}
