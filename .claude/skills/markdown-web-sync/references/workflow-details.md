# Workflow Details

## Phase 1: Initialization & Progress Tracking

### Step 1: Scan Directory
List all markdown files in the **Target Directory** using Glob tool.

### Step 2: Load/Create Status Tree
```markdown
# Verification Status

Root: `/path/to/target/directory`

## Progress
- [ ] file1.md
- [ ] file2.md
- [/] file3.md  ← Currently working
- [x] file4.md  ← Completed
```

### Step 3: Display Progress Summary
Show user:
- Total files
- Verified count
- In-progress count
- Remaining count

---

## Phase 2: Verification Loop

### Step 2.1: Select Target
1. Identify the current file (user-specified or next `[ ]` in list)
2. Update status to `[/]` (In Progress)

### Step 2.2: Context Setup

**Read File**:
```
Use Read tool to get current markdown content
```

**Open Browser**:
- Ask user for Target URL if not provided
- Use Playwright MCP or Chrome DevTools MCP to open the page
- Goal: Have Editor (markdown) and Browser ready for comparison

### Step 2.3: Edit & Verify Cycle

1. **Listen**: Wait for user instruction
   - "Add the table from the footer"
   - "Fix the phone number"
   - "Update the link"

2. **Act**:
   - Analyze specific HTML content (inspect if needed)
   - Apply changes using Edit tool

3. **Log**: Append entry to verification_log.md
   ```
   | 2026-01-23 15:30 | kurashi/index.md | Update | Added emergency contact table |
   ```

### Step 2.4: Finalize File

When user is satisfied:
1. Ask: "Mark this file as complete?"
2. If yes:
   - Update status to `[x]`
   - Offer to commit changes
   - Ask to proceed to next file

---

## Log Format

```markdown
# Verification Log

| Date | File | Action | Details |
|------|------|--------|---------|
| 2026-01-23 15:30 | kurashi/index.md | Update | Added emergency contact table |
| 2026-01-23 15:45 | kurashi/index.md | Verify | Confirmed against web content |
```

### Action Types
- `Create` - New file created
- `Update` - Content modified
- `Verify` - Confirmed accuracy
- `Skip` - Intentionally skipped
- `Revert` - Rolled back changes
