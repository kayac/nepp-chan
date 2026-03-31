import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, relative } from "node:path";
import { glob } from "glob";
import matter from "gray-matter";

/**
 * LLM（Gemini Flash Lite）で本文から date/contact を抽出し、
 * 信頼度付きの中間ファイル（TSV）に出力するスクリプト。
 *
 * - high: 自動で frontmatter に書き込み可
 * - medium/low: 人間レビューが必要
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/extract-date-contact.ts
 *   tsx --env-file=.env.local scripts/extract-date-contact.ts --dry-run
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DATASET_BASE = "./dataset";

/** dataset/ 配下の最新バージョンの src/ を自動検出 */
function resolveLatestDatasetSrc(): string {
  const versions = glob
    .sync(`${DATASET_BASE}/v*/src/`)
    .map((p) => {
      const match = p.match(/\/v(\d+)\//);
      return match ? { path: p, version: Number(match[1]) } : null;
    })
    .filter((v): v is { path: string; version: number } => v !== null)
    .sort((a, b) => b.version - a.version);

  if (versions.length === 0) {
    console.error("dataset/v*/src/ が見つかりません");
    process.exit(1);
  }

  return versions[0].path.replace(/\/$/, "");
}

function resolveTargetDir(): string {
  const args = process.argv.slice(2);
  const targetArg = args.find((a) => a.startsWith("--target="));

  if (!targetArg) {
    console.error("--target=<dataset|knowledge> を指定してください");
    console.error("  例: pnpm frontmatter:extract -- --target=dataset");
    process.exit(1);
  }

  const target = targetArg.split("=")[1];
  if (target === "dataset") return resolveLatestDatasetSrc();
  if (target === "knowledge") return "./knowledge";

  console.error(`不明な target: ${target}（dataset または knowledge を指定）`);
  process.exit(1);
}

const TARGET_DIR = resolveTargetDir();
const OUTPUT_DIR = "./review";
const OUTPUT_FILE = `${OUTPUT_DIR}/date-contact-candidates.tsv`;
const AUTO_APPLIED_FILE = `${OUTPUT_DIR}/date-contact-auto-applied.tsv`;
const REVIEW_FILE = `${OUTPUT_DIR}/date-contact-needs-review.tsv`;

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!API_KEY) {
  console.error(
    "GOOGLE_GENERATIVE_AI_API_KEY が未設定です。--env-file=.env.local を指定してください。",
  );
  process.exit(1);
}

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

/** otoko/ タイムスタンプファイル名パターン: 2025-0411-1913-11.md */
const TIMESTAMP_FILENAME_RE = /^(\d{4})-(\d{2})(\d{2})-\d{4}-\d{2}\.md$/;

/** 広報誌ファイル名パターン: 2025-12.md */
const KOUHOU_FILENAME_RE = /^(\d{4})-(\d{2})\.md$/;

/** frontmatter url 内のタイムスタンプパターン */
const URL_TIMESTAMP_RE = /(\d{4})-(\d{2})(\d{2})-\d{4}-\d{2}/;

/** API レート制限対策 */
const DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * date_type: 日付の性質
 * - exact:     本文・ファイル名に明示的な日付がある
 * - estimated: 間接的な手がかりから推測した日付
 * - observed:  掲載確認日（スクレイピング日）
 * - evergreen: 日付に依存しない恒久的な情報
 */
type DateType = "exact" | "estimated" | "observed" | "evergreen";

interface LLMExtraction {
  date: string | null;
  date_confidence: "high" | "medium" | "low";
  date_evidence: string;
  contact: string | null;
  contact_confidence: "high" | "medium" | "low";
  contact_evidence: string;
}

interface ExtractResult {
  file: string;
  date_source: "filename" | "url" | "llm" | "none";
  date: string;
  date_type: DateType;
  date_confidence: string;
  date_evidence: string;
  contact: string;
  contact_confidence: string;
  contact_evidence: string;
}

// ---------------------------------------------------------------------------
// Deterministic date extraction (filename / url)
// ---------------------------------------------------------------------------

/** ファイル名からdate抽出（タイムスタンプ系 or 広報誌 YYYY-MM） */
function extractDateFromFilename(filename: string): string | null {
  const name = basename(filename);

  // otoko/ タイムスタンプ: 2025-0411-1913-11.md → 2025-04-11
  const tsMatch = name.match(TIMESTAMP_FILENAME_RE);
  if (tsMatch) {
    const [, year, month, day] = tsMatch;
    return `${year}-${month}-${day}`;
  }

  // 広報誌: 2025-12.md → 2025-12-01（月初日）
  const kouhouMatch = name.match(KOUHOU_FILENAME_RE);
  if (kouhouMatch) {
    const [, year, month] = kouhouMatch;
    return `${year}-${month}-01`;
  }

  return null;
}

/** frontmatter url からタイムスタンプを抽出 */
function extractDateFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(URL_TIMESTAMP_RE);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// LLM extraction
// ---------------------------------------------------------------------------

// ---- Pass 1: date + contact 抽出 ----

const EXTRACTION_PROMPT = `以下のMarkdownドキュメントから、2つの情報を抽出してください。

## 抽出項目

### 1. date（情報の更新日・公開日）

- YYYY-MM-DD 形式で出力
- 「令和N年度」→ 西暦に変換し4月1日（例: 令和7年度 → 2025-04-01）
- 「令和N年M月D日」→ 西暦に変換（令和 = 2018 + N）
- 複数の日付がある場合、ドキュメント全体の公開日・更新日に最も近いものを選択
- 間接的な手がかりからの推測も可:
  - 「2025-2026シーズン営業予定」→ 2025-10-01
  - 「令和7年12月末までに提出」→ 2025-04-01
  - 「○月○日（金）」で曜日が特定年にしか一致しない → その年の日付
- 日付が見つからない場合は null

### 2. contact（問い合わせ先）
- 「〇〇課」「〇〇室」「〇〇係」等の課名を抽出
- 電話番号は不要（課名のみ）
- 見つからない場合は null

## 信頼度の判定基準
- **high**: 明確な日付 / 明確な課名
- **medium**: 間接推測が必要、候補が複数ある
- **low**: 曖昧、推測に強く依存する

## 出力（JSON）
\`\`\`json
{
  "date": "YYYY-MM-DD" or null,
  "date_confidence": "high" | "medium" | "low",
  "date_evidence": "判断根拠（元テキストの引用）",
  "contact": "課名" or null,
  "contact_confidence": "high" | "medium" | "low",
  "contact_evidence": "判断根拠（元テキストの引用）"
}
\`\`\`

## ドキュメント
`;

// ---- Pass 2: evergreen vs observed 判定（date=null のファイルのみ） ----

const DATETYPE_PROMPT = `あなたは自治体ウェブサイトの情報鮮度を判定する専門家です。

以下のドキュメントを読んで、1つだけ判断してください:

**「この情報を1年後に誰かが読んだとき、内容が変わっていて困る可能性があるか？」**

## 判定基準

### observed（変わっている可能性がある → 困る）
具体例:
- 「営業時間 9:30〜16:30」→ 時間が変わる可能性
- 「リフト券 大人500円」→ 料金が変わる可能性
- 「電話 01656-5-3111」→ 番号が変わったら連絡できない
- 「月曜定休」→ 変わる可能性
- 「担当: 住民課」→ 組織改編の可能性
- 「申請書はこちら」→ 様式が変わる可能性
- 「受付時間 8:30〜17:15」→ 変わる可能性
- 「令和7年度の納期限」→ 年度ごとに変わる

### evergreen（変わらない → 困らない）
具体例:
- 「音威子府村は北海道の北部にあります」→ 地理的事実
- 「天北線は1989年に廃止されました」→ 歴史的事実
- 「均等割とは所得に関わらず一定額を負担する仕組み」→ 制度の概念（金額ではなく仕組み）
- リンク集・目次ページ（他ページへの参照のみ）
- 「砂澤ビッキの作品を展示」→ 美術館の歴史的背景

## 重要な注意
- 電話番号、料金、時間、期限を **1つでも含む** ドキュメントは **observed** です
- 迷ったら **observed** を選んでください（安全側に倒す）

## 出力（JSON）
\`\`\`json
{
  "date_type": "observed" | "evergreen",
  "reason": "判断理由（1文）"
}
\`\`\`

## ドキュメント
`;

async function extractWithLLM(content: string): Promise<LLMExtraction> {
  // 本文が長すぎる場合は先頭3000文字に切り詰め（日付・問い合わせ先は通常先頭付近にある）
  const truncated =
    content.length > 3000
      ? `${content.slice(0, 3000)}\n\n（以下省略）`
      : content;

  const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: EXTRACTION_PROMPT + truncated }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return {
      date: null,
      date_confidence: "low",
      date_evidence: "LLM応答なし",
      contact: null,
      contact_confidence: "low",
      contact_evidence: "LLM応答なし",
    };
  }

  try {
    return JSON.parse(text) as LLMExtraction;
  } catch {
    return {
      date: null,
      date_confidence: "low",
      date_evidence: `JSONパース失敗: ${text.slice(0, 100)}`,
      contact: null,
      contact_confidence: "low",
      contact_evidence: "JSONパース失敗",
    };
  }
}

/** Pass 2: evergreen vs observed を専用プロンプトで判定 */
async function classifyDateType(
  content: string,
): Promise<{ date_type: DateType; reason: string }> {
  const truncated =
    content.length > 3000
      ? `${content.slice(0, 3000)}\n\n（以下省略）`
      : content;

  const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: DATETYPE_PROMPT + truncated }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    return { date_type: "observed", reason: "API error — 安全側に倒す" };
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return { date_type: "observed", reason: "LLM応答なし — 安全側に倒す" };
  }

  try {
    const parsed = JSON.parse(text);
    return {
      date_type: parsed.date_type === "evergreen" ? "evergreen" : "observed",
      reason: parsed.reason || "",
    };
  } catch {
    return { date_type: "observed", reason: "JSONパース失敗 — 安全側に倒す" };
  }
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

async function processFile(filePath: string): Promise<ExtractResult> {
  const raw = readFileSync(filePath, "utf-8");
  const { data: existing, content } = matter(raw);
  const relPath = relative(TARGET_DIR, filePath);

  // Skip if date already in frontmatter
  if (existing.date) {
    return {
      file: relPath,
      date_source: "none",
      date: String(existing.date),
      date_type: (existing.date_type as DateType) || "exact",
      date_confidence: "high",
      date_evidence: "既存frontmatter",
      contact: existing.contact || "",
      contact_confidence: existing.contact ? "high" : "",
      contact_evidence: existing.contact ? "既存frontmatter" : "",
    };
  }

  // 1. ファイル名からdate抽出（タイムスタンプ or 広報誌）→ high
  const filenameDate = extractDateFromFilename(filePath);

  // 2. frontmatter url からdate抽出 → high
  const urlDate = extractDateFromUrl(existing.url);

  // 機械的にdateが確定した場合でも、LLMでcontactとdate検証を行う
  const deterministicDate = filenameDate || urlDate;
  const deterministicSource = filenameDate
    ? "filename"
    : urlDate
      ? "url"
      : null;
  const deterministicEvidence = filenameDate
    ? `ファイル名: ${basename(filePath)}`
    : urlDate
      ? `URL: ${existing.url}`
      : "";

  // 3. LLM で抽出（date確定済みでもcontact抽出 + date検証のために実行）
  const llm = await extractWithLLM(content);

  // 機械的dateがある場合はそちらを優先、LLMはcontactとdate検証に使う
  if (deterministicDate) {
    return {
      file: relPath,
      date_source: deterministicSource as "filename",
      date: deterministicDate,
      date_type: "exact" as DateType,
      date_confidence: "high",
      date_evidence: deterministicEvidence,
      contact: llm.contact || "",
      contact_confidence: llm.contact_confidence || "",
      contact_evidence: llm.contact_evidence || "",
    };
  }

  // LLM が date を見つけた場合
  if (llm.date) {
    // date_confidence が medium 以下なら estimated、それ以外は exact
    const dateType: DateType =
      llm.date_confidence === "medium" || llm.date_confidence === "low"
        ? "estimated"
        : "exact";
    return {
      file: relPath,
      date_source: "llm",
      date: llm.date,
      date_type: dateType,
      date_confidence: llm.date_confidence || "",
      date_evidence: llm.date_evidence || "",
      contact: llm.contact || "",
      contact_confidence: llm.contact_confidence || "",
      contact_evidence: llm.contact_evidence || "",
    };
  }

  // date=null → Pass 2 で evergreen vs observed を判定
  const classification = await classifyDateType(content);

  return {
    file: relPath,
    date_source: "none",
    date: "",
    date_type: classification.date_type,
    date_confidence: "",
    date_evidence: classification.reason,
    contact: llm.contact || "",
    contact_confidence: llm.contact_confidence || "",
    contact_evidence: llm.contact_evidence || "",
  };
}

// ---------------------------------------------------------------------------
// TSV output
// ---------------------------------------------------------------------------

const TSV_HEADER = [
  "file",
  "date_source",
  "date",
  "date_type",
  "date_confidence",
  "date_evidence",
  "contact",
  "contact_confidence",
  "contact_evidence",
].join("\t");

function toTsvRow(r: ExtractResult): string {
  return [
    r.file,
    r.date_source,
    r.date,
    r.date_type,
    r.date_confidence,
    r.date_evidence.replace(/\t/g, " ").replace(/\n/g, " "),
    r.contact,
    r.contact_confidence,
    r.contact_evidence.replace(/\t/g, " ").replace(/\n/g, " "),
  ].join("\t");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const files = glob.sync(`${TARGET_DIR}/**/*.md`);
  console.log(`Found ${files.length} files`);
  console.log(`Mode: ${dryRun ? "DRY RUN（10件のみ）" : "FULL"}\n`);

  // dry-run: 日付がありそうなファイルを含むサンプルを選択
  const targetFiles = dryRun
    ? [
        ...files.filter((f) => f.includes("kouhou/")).slice(0, 3),
        ...files.filter((f) => f.includes("otoko/event/")).slice(0, 3),
        ...files.filter((f) => f.includes("hokenfukushi")).slice(0, 2),
        ...files.filter((f) => f.includes("shisetsu")).slice(0, 2),
      ]
    : files;
  const results: ExtractResult[] = [];

  for (let i = 0; i < targetFiles.length; i++) {
    const file = targetFiles[i];
    const relPath = relative(TARGET_DIR, file);
    process.stdout.write(`  [${i + 1}/${targetFiles.length}] ${relPath}...`);

    try {
      const result = await processFile(file);
      results.push(result);

      const dateInfo = result.date
        ? `date=${result.date}(${result.date_confidence})`
        : "date=なし";
      const contactInfo = result.contact
        ? `contact=${result.contact}(${result.contact_confidence})`
        : "contact=なし";
      console.log(` ${dateInfo} ${contactInfo}`);
    } catch (err) {
      console.log(` ERROR: ${err}`);
      results.push({
        file: relPath,
        date_source: "none",
        date: "",
        date_confidence: "low",
        date_evidence: `エラー: ${err}`,
        contact: "",
        contact_confidence: "low",
        contact_evidence: `エラー: ${err}`,
      });
    }

    // Rate limiting
    if (i < targetFiles.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  // Split results by confidence
  const autoApply = results.filter(
    (r) =>
      (r.date && r.date_confidence === "high") ||
      (r.contact && r.contact_confidence === "high"),
  );
  const needsReview = results.filter(
    (r) =>
      (r.date && r.date_confidence !== "high") ||
      (r.contact && r.contact_confidence !== "high" && r.contact !== ""),
  );

  // Stats
  const hasDate = results.filter((r) => r.date !== "");
  const hasContact = results.filter((r) => r.contact !== "");
  const highDate = results.filter(
    (r) => r.date && r.date_confidence === "high",
  );
  const highContact = results.filter(
    (r) => r.contact && r.contact_confidence === "high",
  );

  console.log("\n--- 抽出サマリー ---");
  console.log(
    `  date あり:    ${hasDate.length}件（high: ${highDate.length}, その他: ${hasDate.length - highDate.length}）`,
  );
  console.log(
    `  contact あり: ${hasContact.length}件（high: ${highContact.length}, その他: ${hasContact.length - highContact.length}）`,
  );
  console.log(`  date なし:    ${results.length - hasDate.length}件`);
  console.log(`  合計:         ${results.length}件`);
  console.log("");
  console.log(`  自動適用可（high）:  ${autoApply.length}件`);
  console.log(`  要レビュー:          ${needsReview.length}件`);

  // Write TSV files
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // All results
  writeFileSync(OUTPUT_FILE, [TSV_HEADER, ...results.map(toTsvRow)].join("\n"));

  // Auto-apply (high confidence)
  writeFileSync(
    AUTO_APPLIED_FILE,
    [TSV_HEADER, ...autoApply.map(toTsvRow)].join("\n"),
  );

  // Needs review (medium/low)
  writeFileSync(
    REVIEW_FILE,
    [TSV_HEADER, ...needsReview.map(toTsvRow)].join("\n"),
  );

  console.log(`\n📁 全件:       ${OUTPUT_FILE}`);
  console.log(`📁 自動適用可: ${AUTO_APPLIED_FILE}`);
  console.log(`📁 要レビュー: ${REVIEW_FILE}`);
  console.log("\n次のステップ:");
  console.log("  1. 要レビューファイルを確認・修正");
  console.log("  2. pnpm frontmatter:apply-date で自動適用を実行");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
