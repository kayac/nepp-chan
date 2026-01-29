# OCR Experiments for PDF Conversion

This directory contains experiments for converting complex layout PDFs (like public relations magazines) to Markdown.

## Methods Tested

### 1. `pdftotext -layout` (Baseline)
- **Path**: `results/pdftotext_layout/`
- **Pros**: Fast, standard tool.
- **Cons**: Terrible with multi-column layouts; merges columns, garbles vertical text.

### 2. `Docling`
- **Path**: `results/docling/`
- **Script**: `scripts/convert_docling.py`
- **Status**: Slow on CPU; high quality but resource intensive.

### 3. Gemini Vision (Manual/API)
- **Path**: `results/gemini_vision/`
- **Method**: Screenshot -> Gemini 1.5 Pro
- **Pros**: Excellent layout understanding, perfect ordering of text blocks.
- **Cons**: Costly (tokens/API calls), slow for bulk processing, potential rate limits.

### 4. `YomiToku` (Recommended Local Solution)
- **Path**: `results/yomitoku/`
- **Script**: `scripts/convert_yomitoku.py`
- **Method**: Japanese-specialized OCR libraries via `uv` execution.
- **Pros**: High accuracy with vertical text and multi-columns. Runs locally (free).
- **Cons**: Requires heavy dependencies (pytorch), slightly slow on CPU (but works on M4).

## Comparison
| Method | Vertical Text | Multi-Column | Speed | Cost |
| :--- | :--- | :--- | :--- | :--- |
| **pdftotext** | ❌ Fail | ❌ Fail | 🚀 Instant | Free |
| **Docling** | 🔺 OK | ⭕ Good | 🐢 Slow | Free (Local) |
| **Gemini** | ⭕ Excellent | ⭕ Excellent | 🐇 Fast | 💰 Paid/Quota |
| **YomiToku** | ⭕ Excellent | ⭕ Excellent | 🐢 Slow | Free (Local) |

## Usage
To run YomiToku (Recommended):
```bash
uv run --with yomitoku --with opencv-python-headless --with torch --with torchvision python3 scripts/convert_yomitoku.py <input_image_or_pdf> <output.md>
```
