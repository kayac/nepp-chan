# OCR Quality Evaluation Report

**Target:** `2021-04.pdf` Page 2
**Gold Standard Reference:** `knowledge/v2src/ocr_experiments/results/gemini_vision/2021-04_p2.md`
**Source Image:** `knowledge/v2src/ocr_experiments/inputs/test_page_2-02.png`

## 1. YomiToku Vanilla Output
**File:** `results/yomitoku/2021-04_vanilla_p2.md`

### Analysis
- **Text Recognition:** High accuracy. Most characters are correct.
- **Layout/Structure:** correctly identified main blocks. However, headers are sequential without hierarchy.
- **Reading Order:** Correctly processed vertical text from Right-to-Left columns.
- **Issues:**
    - **Line Breaks:** Japanese sentences are split by newlines (hard wraps), making it difficult to read or copy-paste.
    - **OCR Errors:** Minor misrecognition, e.g., `筬島駅` (Osashima) recognized as `晟島駅`.
    - **Noise:** Page numbers (`no.559`, `apr.`) and artifacts included.

### Score: 85/100
Good raw material, but requires post-processing for human consumption.

---

## 2. Refined Output (YomiToku + LLM Processing)
**File:** `results/yomitoku/2021-04_refined_p2.md`

### Analysis
- **Text Flow:** Perfect. Line breaks effectively removed to form natural paragraphs.
- **Structure:** Headers are hierarchically organized (`##`, `###`), matching the logical flow of the magazine.
- **Accuracy:**
    - Corrected `晟島駅` to `筬島駅` (contextual correction).
    - Removed noise like page numbers and decorative English text (`otoineppu public relations...`).
- **Layout Fidelity:** Preserved the distinct sections ("Initial Address" -> "Everyone's Station" -> "Executive Committee") in the correct Japanese reading order (Right-to-Left vertical logic).

### Score: 98/100
Near-perfect reproduction of the content in a clean Markdown format. Comparable to direct Gemini Vision output.

## Conclusion
The **YomiToku + LLM Refinement** workflow provides the best balance of cost and quality.
- **YomiToku** handles the heavy lifting of spatial structure and character recognition locally (Free).
- **LLM (Flash)** cleans up the text and fixes minor OCR inconsistencies (Low Cost).

This approach is highly recommended for the full archive digitization.
