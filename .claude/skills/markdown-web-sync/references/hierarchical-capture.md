# Hierarchical Page Capture Guide

## Overview

This guide explains how to capture multi-level web content into a MECE (Mutually Exclusive, Collectively Exhaustive) markdown structure.

## Problem Statement

Web sites often have nested structure:
```
Level 1: /gyousei/index.html (行政情報)
Level 2: /gyousei/gyouzaisei/ (行財政情報)
Level 3: /gyousei/gyouzaisei/gyouzaiseihoukoku.html (行財政報告)
```

Without proper capture, information from Level 3 may be lost or duplicated.

---

## Capture Strategy

### Step 1: Map Site Structure

Use browser tools to explore the full site hierarchy:

```bash
# Example output
gyousei/
├── index.html                      # L1: 行政情報トップ
├── gyouzaisei/                     # L2: 行財政情報
│   ├── index.html                  # 人事行政の運営等
│   ├── gyouzaiseihoukoku.html      # 行財政報告
│   ├── 2017-0330-1655-14.html      # 地方行政サービス改革
│   ├── chihoukouei_bappon.html     # 地方公営企業改革
│   ├── tokutei_jigyo.html          # 特定事業主行動計画
│   ├── 2017-0509-1106-14.html      # マイナンバー制度
│   ├── template_koronakouhukin.html # 地方創生臨時交付金
│   ├── ksk_plan.html               # 公共施設等総合管理計画
│   └── otoineppu_sogosenryaku.html # 人口ビジョン・総合戦略
├── saiyou/                         # L2: 職員採用
├── nyusatsu/                       # L2: 入札情報
├── keikaku/                        # L2: 各種計画
└── muraokoshi/                     # L2: 地域おこし協力隊
```

### Step 2: Create Directory Structure

Mirror the web structure in markdown:

```bash
knowledge/v2src/villotoinep/gyousei/
├── index.md                        # ナビゲーションのみ
├── gyouzaisei/
│   ├── index.md                    # 人事行政 (L2コンテンツ)
│   ├── gyouzaiseihoukoku.md        # 行財政報告 (L3コンテンツ)
│   ├── service-reform.md           # 地方行政サービス改革
│   ├── enterprise-reform.md        # 地方公営企業改革
│   ├── action-plan.md              # 特定事業主行動計画
│   ├── mynumber.md                 # マイナンバー制度
│   ├── covid-grant.md              # 地方創生臨時交付金
│   ├── facility-plan.md            # 公共施設等総合管理計画
│   └── population-vision.md        # 人口ビジョン・総合戦略
├── saiyou.md                       # フラットでOKなら単一ファイル
├── nyusatsu/
│   ├── index.md
│   └── ...
└── ...
```

### Step 3: Content Placement Rules

| Page Type | Content |
|-----------|---------|
| **L1 Index** | Navigation links only (wikilinks to L2) |
| **L2 Index** | Brief description + wikilinks to L3 |
| **L3 Detail** | Full content from the web page |
| **PDF/Excel** | External link (don't duplicate) |

---

## Example: gyousei/index.md (L1)

```markdown
# 行政情報

音威子府村の行政に関する情報です。

## [行財政情報](gyouzaisei/index.md)
行財政報告、人事行政、地方行政サービス改革など

## [職員採用](saiyou.md)
職員採用情報

## [入札情報](nyusatsu/index.md)
入札受付情報、入札結果、公共工事の公表

...
```

## Example: gyousei/gyouzaisei/index.md (L2)

```markdown
# 行財政情報

## コンテンツ一覧

- [行財政報告](gyouzaiseihoukoku.md)
- [人事行政の運営等の状況報告](jinji.md)
- [地方行政サービス改革](service-reform.md)
- [地方公営企業改革](enterprise-reform.md)
- [特定事業主行動計画](action-plan.md)
- [マイナンバー制度](mynumber.md)
- [地方創生臨時交付金](covid-grant.md)

## 経営戦略 (PDF)
- [農業集落排水事業](https://example.com/nousyuu.pdf)
- [簡易水道事業](https://example.com/kansui.pdf)
```

## Example: gyousei/gyouzaisei/gyouzaiseihoukoku.md (L3)

```markdown
# 行財政報告

## 財政健全化判断比率

| 年度 | 資料 |
|------|------|
| 令和6年度 | [PDF](https://...) |
| 令和5年度 | [PDF](https://...) |
...

## 財政報告

| 年度 | 財政状況総括表 | 財政比較分析表 |
|------|---------------|---------------|
| 令和7年度 | [PDF](https://...) | [PDF](https://...) |
...

## 経営比較分析表

### 簡易水道事業
...

### 農業集落排水事業
...

---

[← 行財政情報に戻る](index.md)
```

---

## Verification Checklist

Before marking a directory as complete:

- [ ] Site structure fully mapped
- [ ] All L3 pages have corresponding MD files
- [ ] L1/L2 index pages contain only navigation
- [ ] No content exists only in parent page
- [ ] All external links preserved
- [ ] Back-links (`← 戻る`) added to detail pages

---

## Hybrid Approach: UI Category + Content Merge

### Problem: Disconnected Site Structure

Some sites have **UI categories** (navigation) separate from **content directories**:

```
UI Categories (ナビ用):          Content Directories (実データ):
├── kurashi/                     ├── kakuka/
│   └── リンク集のみ               │   ├── juuminseikatsu/ ← 税金、年金、環境
├── gyousei/                     │   ├── hokenfukushi/   ← 福祉
│   └── リンク集のみ               │   ├── kyouikuiin/     ← 教育
└── ...                          │   └── soumuzaisei/    ← 手続き
                                 └── ...
```

### Solution: UI-based Structure with Content Merge

**Principle**: RAGでは重複がないことが最優先。UIカテゴリ構造を採用し、実コンテンツをマージする。

```
MD Structure (UIベース):
├── kurashi/
│   ├── zeikin/
│   │   ├── index.md
│   │   ├── juminzei.md      ← kakuka/juuminseikatsu/ からマージ
│   │   └── kotei.md         ← kakuka/juuminseikatsu/ からマージ
│   └── kenkou_fukushi/
│       └── ...              ← kakuka/hokenfukushi/ からマージ
└── ...
```

### Content Merge Rules

| 状況 | 対応 |
|------|------|
| UIカテゴリページがリンク集のみ | リンク先の実コンテンツをMD化してマージ |
| 同一内容が複数URLに存在 | 1箇所のみ作成、他はwikilink参照 |
| kakuka/配下の独自コンテンツ | 適切なUIカテゴリに配置 |
| 元URLの記録 | MDファイル末尾に`参照: [元URL]`として記載 |

### Mapping Workflow

1. **UIカテゴリ構造を把握** - グローバルナビ、サイドメニューから
2. **実コンテンツ配置を確認** - リンク先URLを追跡
3. **マッピング表を作成**:
   ```
   | UIカテゴリ | 実コンテンツURL | MD配置先 |
   |-----------|----------------|---------|
   | くらし > 税金 | kakuka/juuminseikatsu/zei*.html | kurashi/zeikin/ |
   ```
4. **重複チェック** - 同一コンテンツが複数カテゴリから参照されていないか
5. **MD作成** - UIカテゴリ構造でディレクトリ作成、実コンテンツをマージ

### Example: Content Merge

**Before (外部リンク)**:
```markdown
# 税金
- [村道民税について](https://example.com/kakuka/juuminseikatsu/zei1.html)
```

**After (コンテンツマージ)**:
```markdown
# 税金
- [村道民税について](juminzei.md)
```

**kurashi/zeikin/juminzei.md**:
```markdown
# 村道民税について

[実際のコンテンツをここに記載]

---

参照: https://example.com/kakuka/juuminseikatsu/zei1.html

[← 税金に戻る](index.md)
```

---

## Common Mistakes

### ❌ Wrong: Embedding L3 content in L2

```markdown
# 行財政情報 (gyouzaisei.md)

## 行財政報告
| 年度 | 資料 |
|------|------|
| 令和6年度 | [PDF](...) |
...
```

### ✅ Correct: Separate L3 file

**gyouzaisei/index.md**:
```markdown
# 行財政情報
- [行財政報告](gyouzaiseihoukoku.md)
```

**gyouzaisei/gyouzaiseihoukoku.md**:
```markdown
# 行財政報告
| 年度 | 資料 |
|------|------|
| 令和6年度 | [PDF](...) |
...
```
