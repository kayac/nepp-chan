---
name: markdown-web-sync
description: |
  Manages verification of markdown files against live web pages. Tracks progress (Unverified/In Progress/Verified), logs changes, and facilitates side-by-side editing.

  Use when:
  - User wants to check markdown documentation against a website
  - User asks to "start verification" or "compare files with the web"
  - Validation of scraped content is needed

  NOT for:
  - Creating new markdown files from scratch
  - PDF-only verification (use pdf_ocr_yomitoku skill instead)
allowed-tools: Read,Write,Edit,Glob,Grep,WebFetch,mcp__playwright-server__*,mcp__chrome-devtools__*
---

# Markdown Web Sync & Verification

## Quick Start

1. **Confirm configuration** with user (target directory, progress/log file locations)
2. **Load progress** from `verification_status.md`
3. **For each file**: Open browser + Read markdown → Compare → Edit → **Update status** → Log
4. **Status update**: `[/]` after edit, `[x]` only after user approval

**RULE**: ファイル操作後は必ず`verification_status.md`を更新すること

## Status Legend

| Status | Meaning | Who can set |
|--------|---------|-------------|
| `[ ]` | Unverified | LLM auto |
| `[/]` | In Progress (created/drafted) | LLM auto |
| `[x]` | Verified by user | **User only** |

### CRITICAL: Status Update Rules

1. **LLMは`[x]`を自動でつけてはならない**（厳禁）
2. ファイル新規作成時 → `[ ]`または`[/]`で追加
3. 内容を確認・編集中 → `[/]`に変更可
4. **`[x]`への変更はユーザーが明示的に承認した場合のみ**
   - ユーザーが「ok」「確認済み」「verified」等と発言した場合のみ許可
   - LLMの判断で「正しそうだから」という理由で`[x]`にしてはならない

### MANDATORY: verification_status.md への記録

**ファイル操作時は必ず`verification_status.md`を更新すること**

| 操作 | 記録内容 |
|------|----------|
| 新規ファイル作成 | `- [ ] path/to/file.md` を追加 |
| 内容編集・確認 | `[ ]` → `[/]` に変更 |
| ユーザー承認後 | `[/]` → `[x]` に変更 |

**記録タイミング**:
- ファイルをWriteした直後に即座に記録
- 複数ファイル作成時も1ファイルごとに記録
- 記録漏れは許容しない

**記録形式**:
```markdown
### section_name/
- [ ] section_name/new_file.md
- [/] section_name/edited_file.md <!-- https://example.com/page.html -->
- [x] section_name/verified_file.md <!-- https://example.com/verified.html -->
```

**URL記録ルール**:
- **検証時に確認したURLは必ず記録する**（HTMLコメント形式）
- 形式: `- [x] path/to/file.md <!-- https://actual-url-verified.html -->`
- URLが404の場合: 実際にアクセスできたURLを記録
- 複数URLを確認した場合: 最終的に検証に使用したURLを記録

**PDF外部リンク記録ルール**:
- MDファイル内のPDFが外部リンクのまま（内容未取り込み）の場合、verification_status.mdに明記する
- 形式: `- [x] path/to/file.md <!-- URL / PDFは外部リンクのまま -->`
- これにより、後でPDF内容の取り込みが必要かどうか判断できる

**セクションがない場合**: 適切な位置に新規セクションを追加

## Content Sync Rules

### 追加ルール（Web → MD）

| 状況 | 対応 |
|------|------|
| Web にあって MD にない情報 | 基本的に **追記する** |
| 該当ページに下の階層がない | **ディレクトリ作成** + verification_status.md に追記 |

### 削除ルール（MD からの削除）

**原則**: MD からのテキスト削除は慎重に行う

| 状況 | 対応 |
|------|------|
| Web に存在しない情報を MD から削除したい | **TaskCreate で積む**（即時削除しない） |
| 削除理由 | Task の description に明記 |
| 実行タイミング | 後で QA ツールで確認後に実行 |

**理由**: 削除は取り消しが難しく、過去に正当な理由で追加された情報の可能性がある

---

## Core Workflow

### Phase 1: Initialize
```
1. Scan target directory for markdown files
2. Load/create verification_status.md
3. Show progress summary to user
```

### Phase 2: Verification Loop (per file)
```
1. Select next unverified file → Mark [/] in verification_status.md
2. Read markdown content
3. Open BOTH:
   - Browser: corresponding web page
   - IDE: markdown file (code <filepath>)
4. Take screenshot and report differences
5. Wait for user instructions (e.g., "Add the table", "Fix the phone number")
6. Apply changes to markdown
7. **IMMEDIATELY update verification_status.md** (new file → add entry, edit → mark [/])
8. Log changes to verification_log.md
9. **WAIT for explicit user approval** (e.g., "ok", "確認済み", "verified")
10. Only after user approval → Mark [x] in verification_status.md and proceed to next
```

**記録の順序**: Write/Edit → verification_status.md更新 → 次の操作

**IMPORTANT**: Always open BOTH browser AND IDE simultaneously for side-by-side comparison.

**CRITICAL**: LLMは`[x]`を自動で付与してはならない。ユーザーの明示的な承認を必ず待つこと。

### IDE Open Rules

1. **Sandbox無効必須**: `code`コマンドは`dangerouslyDisableSandbox: true`で実行
   ```bash
   code -r <filepath>  # with dangerouslyDisableSandbox: true
   ```

2. **出力フォーマット**: ファイルパスは別行でクリック可能に
   ```
   次は
   `about/jinkou_kokudo.md`
   （人口・国土）です。
   ```

3. **OKで次へ**: ユーザーが明示的に「ok」「確認済み」等と承認した場合のみ`[x]`に更新
   - **LLMが勝手に`[x]`をつけることは厳禁**
   - ファイル作成・編集時点では`[/]`まで

### Phase 3: Finalize
```
1. Commit changes (if requested)
2. Proceed to next file or end session
```

## Hierarchical Page Capture (MECE)

**CRITICAL**: Ensure all web page content is captured in markdown, including nested pages.

### Directory Structure Principle

Web site structure should mirror markdown directory structure:

```
Web: /gyousei/
├── index.html          → gyousei/index.md
├── gyouzaisei/
│   ├── index.html      → gyousei/gyouzaisei/index.md
│   ├── report.html     → gyousei/gyouzaisei/report.md
│   └── files/*.pdf     → Referenced as external links
└── saiyou/
    └── index.html      → gyousei/saiyou/index.md
```

### Capture Rules

1. **Index pages**: Contain only navigation links (wikilinks) to child pages
2. **Detail pages**: Contain full content from corresponding web page
3. **External resources (PDF/Excel)**: Link to original URL, don't duplicate
4. **Third-level pages**: Always create separate MD files
5. **Directory rule**: If a page has child pages, ALWAYS create a directory (even if children are just PDF link pages). Don't ask, just do it.

### Wikilink Convention

Use relative links within the same directory:
```markdown
## [行財政情報](gyouzaisei/index.md)
```

Use `../` for parent directory:
```markdown
[← 戻る](../index.md)
```

### MECE Checklist

Before marking a section as verified:
- [ ] All items listed on web index page have corresponding markdown
- [ ] Each detail page has its own markdown file
- [ ] No information exists only in parent page (must be in child)
- [ ] All external links are preserved
- [ ] Directory structure matches web hierarchy

## Helper Commands

| Command | Action |
|---------|--------|
| "Show Progress" | Display verification_status.md |
| "History" | Show recent verification_log.md entries |
| "Skip" | Leave current file and move to next |

## Safety Rules

- **No Silent Overwrites**: Always log major changes
- **Human in the Loop**: Rely on user confirmation for subjective matches
- **Anti-Rollback**: Check log before making changes to avoid reverting previous fixes
- **No Orphan Files**: ファイル作成後は必ずverification_status.mdに記録
- **Status Sync**: verification_status.mdと実ファイルの整合性を常に維持

## References

For detailed guidelines:
- @references/workflow-details.md - Full workflow with examples
- @references/pdf-handling.md - PDF content conversion standards
- @references/hierarchical-capture.md - Hierarchical page capture guide
