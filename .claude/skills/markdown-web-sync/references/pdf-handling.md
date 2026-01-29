# PDF Content Handling

When converting PDFs to Markdown, adhere to these strict quality standards.

## 1. Text Parsing & Cleaning

### Clean Text
- No garbage characters
- No weird line breaks
- No excessive whitespace

### Natural Flow
- Rejoin broken lines (PDF hard wraps) into natural paragraphs
- Markdown should read like a normal document, not a rigid layout copy

**Bad**:
```
This is a sen
tence that was
broken by PDF
line wraps.
```

**Good**:
```
This is a sentence that was broken by PDF line wraps.
```

---

## 2. Structural Integrity

### Hierarchy from Visuals
Analyze font sizes and indentations to reconstruct:
- Headers: `#`, `##`, `###`
- Lists: `-`, `1.`

### Tables
Convert PDF grid layouts into proper Markdown tables.

**Bad** (jumbled text):
```
Name Age City
Alice 30 Tokyo
Bob 25 Osaka
```

**Good** (proper table):
```markdown
| Name | Age | City |
|------|-----|------|
| Alice | 30 | Tokyo |
| Bob | 25 | Osaka |
```

---

## 3. Image-Based Content & Layouts

### When Text Extraction Fails
If a section is:
- Heavily graphical (charts, complex layouts, images)
- OCR fails (empty or garbage text)

**DO NOT** leave garbage text.

### Hybrid Approach

1. **Link to Original PDF**:
```markdown
[Original PDF (Page X)](path/to.pdf)
```

2. **Add Annotation**:
```markdown
> ※ This section contains complex graphical layouts. Please refer to the PDF.
```

### Examples

**Hazard Map**:
```markdown
## 浸水想定区域

> ※ この情報は地図形式で提供されています。詳細は以下のPDFを参照してください。

[ハザードマップPDF](../pdf/hazard_map.pdf)
```

**Budget Table with Complex Layout**:
```markdown
## 令和6年度予算

| 項目 | 金額 |
|------|------|
| 一般会計 | 25億円 |
| 特別会計 | 10億円 |

> ※ 詳細な内訳は原本PDFを参照: [予算書PDF](../pdf/budget_r6.pdf)
```

---

## 4. Quality Checklist

Before marking a PDF-converted file as verified:

- [ ] No garbage characters or OCR artifacts
- [ ] Paragraphs flow naturally (no hard line breaks)
- [ ] Headers hierarchy is correct
- [ ] Tables are properly formatted
- [ ] Complex graphics have PDF links
- [ ] Numbers and dates are accurate

---

## 5. Processing Method Selection

### NG: `pdftotext -layout`

**特徴（検出方法）**:
- 余計な空白・改行が大量に含まれる
- 表組みがスペースで表現され、情報が崩壊している
- AI整形されていない

**対応**: yomitoku でリトライする

### OK: yomitoku + AI整形

**残る問題点（要改善）**:
- `<!-- Page X -->` のようなページ表記 → **削除する**
- 変な改行 → **自然な文章に整形**
- テーブル・段組の抜け落ち → **gemini-flash のビジョンで改善**
- タイトルの抜け落ち → **同上**

### 配置が重要な図・ポスター系

テキスト化しても情報が崩壊する場合:

1. 検索用のキーワードのみ抽出
2. 元PDFのURLリンクを案内

```markdown
## 避難ポスター

**キーワード**: 避難所、災害、緊急連絡先

> ※ このポスターは図形レイアウトが重要です。詳細は以下のPDFを参照してください。

[避難ポスターPDF](https://www.vill.otoineppu.hokkaido.jp/bousai/R03hinannposter.pdf)
```

---

## 6. Retry Queue (pdftotext → yomitoku)

以下のファイルは `pdftotext -layout` で処理されており、yomitoku でリトライが必要:

### parsed/ 直下（20ファイル）
- [ ] R7.9.26kyoka_ichiran.md
- [ ] fuusuigai202003.md
- [ ] map202003.md
- [ ] river_otoineppu_area.md
- [ ] kansui_keieis.md
- [ ] siryou202003.md
- [ ] R7shinseitebiki_sekkeisokuryou.md
- [ ] nousyuu_keieis.md
- [ ] jishin202003.md
- [ ] R7koukyoukouji.md
- [ ] R03hinannposter.md
- [ ] koudoukeikaku.md
- [ ] 2022kogata.md
- [ ] gyouseihoukokur7.md
- [ ] R7shinseitebiki_kensetukouzi.md
- [ ] corona_hinan0928.md
- [ ] R03hinannpoint.md
- [ ] R4rakuhyousetsujikoboushi.md
- [ ] otoineppu_jinko.md
- [ ] otoineppu_sogosenryaku.md

### bousai/ サブディレクトリ（9ファイル）
- [ ] bousai/fuusuigai202003.md
- [ ] bousai/jishin202003.md
- [ ] bousai/siryou202003.md
- [ ] bousai/map202003.md
- [ ] bousai/river_otoineppu_area.md
- [ ] bousai/R03hinannposter.md
- [ ] bousai/R03hinannpoint.md
- [ ] bousai/corona_hinan0928.md
- [ ] bousai/R4rakuhyousetsujikoboushi.md
