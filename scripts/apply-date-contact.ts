import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { glob } from "glob";
import matter from "gray-matter";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const KNOWLEDGE_DIR = "./knowledge";
const DATASET_BASE = "./dataset";
const SCRAPING_DATE = "2026-03-18";
const TSV_PATH = "./review/date-contact-candidates.tsv";

// ---------------------------------------------------------------------------
// Review overrides
// ---------------------------------------------------------------------------

interface ReviewOverride {
  date?: string;
  date_type: string;
}

/** レビュー済み: 承認（estimated として書き込み） */
const APPROVED_OVERRIDES: Record<string, ReviewOverride> = {
  "villotoinep/sangyou/ringyou/bassai_todokede.md": {
    date: "2021-04-01",
    date_type: "estimated",
  },
  "villotoinep/lifeevent/okuyami.md": {
    date: "2014-01-09",
    date_type: "estimated",
  },
  "villotoinep/lifeevent/ninshin_syussan.md": {
    date: "2025-04-01",
    date_type: "estimated",
  },
  "villotoinep/kurashi/kenkou_fukushi/nyuuyouji_josei.md": {
    date: "2025-04-01",
    date_type: "estimated",
  },
  "villotoinep/kakuka/soumuzaisei/oshirase/nyusatsu-uketuke.md": {
    date: "2025-04-01",
    date_type: "estimated",
  },
  "villotoinep/kakuka/hokenfukushi/oshirase/nyuuyouji-iryouhi.md": {
    date: "2025-04-01",
    date_type: "estimated",
  },
  "villotoinep/bousai/index.md": {
    date: "2020-03-01",
    date_type: "estimated",
  },
};

/** レビュー済み: observed に変更（date なし、date_type: observed） */
const OBSERVED_OVERRIDES = new Set([
  "villotoinep/shisetsu/iryou/chiiki_koryu.md",
  "villotoinep/kurashi/zeikin/syoumeisyo.md",
  "villotoinep/kurashi/tetsuduki/furusato_nouzei.md",
  "villotoinep/kurashi/hoken_nenkin/nenkin_tetsuduki.md",
]);

// ---------------------------------------------------------------------------
// TSV parsing
// ---------------------------------------------------------------------------

interface TsvRow {
  file: string;
  date_source: string;
  date: string;
  date_type: string;
  date_confidence: string;
  date_evidence: string;
  contact: string;
  contact_confidence: string;
  contact_evidence: string;
}

function parseTsv(tsvPath: string): TsvRow[] {
  const content = readFileSync(tsvPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  // Skip header
  const [_header, ...dataLines] = lines;

  return dataLines.map((line) => {
    const cols = line.split("\t");
    return {
      file: cols[0] ?? "",
      date_source: cols[1] ?? "",
      date: cols[2] ?? "",
      date_type: cols[3] ?? "",
      date_confidence: cols[4] ?? "",
      date_evidence: cols[5] ?? "",
      contact: cols[6] ?? "",
      contact_confidence: cols[7] ?? "",
      contact_evidence: cols[8] ?? "",
    };
  });
}

// ---------------------------------------------------------------------------
// Dataset directory detection
// ---------------------------------------------------------------------------

function detectLatestDatasetDir(): string {
  try {
    const entries = readdirSync(DATASET_BASE, { withFileTypes: true });
    const versionDirs = entries
      .filter((e) => e.isDirectory() && /^v\d+$/.test(e.name))
      .map((e) => ({
        name: e.name,
        version: Number.parseInt(e.name.slice(1), 10),
      }))
      .sort((a, b) => b.version - a.version);

    if (versionDirs.length === 0) {
      throw new Error("No versioned dataset directories found");
    }

    return `${DATASET_BASE}/${versionDirs[0].name}/src`;
  } catch {
    return `${DATASET_BASE}/v4/src`;
  }
}

// ---------------------------------------------------------------------------
// Processing logic
// ---------------------------------------------------------------------------

type ApplyAction =
  | "date_written"
  | "date_type_only"
  | "contact_only"
  | "both"
  | "skipped";

interface ApplyResult {
  file: string;
  action: ApplyAction;
  dateWritten?: string;
  dateTypeWritten?: string;
  contactWritten?: string;
}

interface Summary {
  dateExact: number;
  dateEstimated: number;
  dateObserved: number;
  dateTypeEvergreen: number;
  contactWritten: number;
  skipped: number;
  total: number;
}

function resolveDate(row: TsvRow): {
  date?: string;
  date_type?: string;
} | null {
  const fileKey = row.file;

  // Check review overrides first
  if (APPROVED_OVERRIDES[fileKey]) {
    return APPROVED_OVERRIDES[fileKey];
  }

  if (OBSERVED_OVERRIDES.has(fileKey)) {
    return { date_type: "observed" };
  }

  // Rule 1: high confidence + date exists
  if (row.date_confidence === "high" && row.date) {
    return { date: row.date, date_type: row.date_type };
  }

  // Rule 2: observed + no date → use scraping date
  if (row.date_type === "observed" && !row.date) {
    return { date: SCRAPING_DATE, date_type: "observed" };
  }

  // Rule 3: evergreen → date_type only
  if (row.date_type === "evergreen") {
    return { date_type: "evergreen" };
  }

  // Rule 4: medium/low confidence → skip
  return null;
}

function resolveContact(row: TsvRow): string | null {
  if (row.contact_confidence === "high" && row.contact) {
    return row.contact;
  }
  return null;
}

function processFile(
  row: TsvRow,
  targetDir: string,
  dryRun: boolean,
): ApplyResult | null {
  const filePath = resolve(targetDir, row.file);

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    // File doesn't exist in this target directory
    return null;
  }

  const { data: existing, content } = matter(raw);

  const dateInfo = resolveDate(row);
  const contact = resolveContact(row);

  // Nothing to write
  if (!dateInfo && !contact) {
    return { file: row.file, action: "skipped" };
  }

  const updated = { ...existing };
  let dateWritten: string | undefined;
  let dateTypeWritten: string | undefined;
  let contactWritten: string | undefined;

  if (dateInfo) {
    if (dateInfo.date) {
      updated.date = dateInfo.date;
      dateWritten = dateInfo.date;
    }
    if (dateInfo.date_type) {
      updated.date_type = dateInfo.date_type;
      dateTypeWritten = dateInfo.date_type;
    }
  }

  if (contact) {
    updated.contact = contact;
    contactWritten = contact;
  }

  if (!dryRun) {
    const output = matter.stringify(content, updated);
    writeFileSync(filePath, output);
  }

  // Determine action type
  let action: ApplyAction;
  if (dateWritten && contactWritten) {
    action = "both";
  } else if (dateWritten || dateTypeWritten) {
    if (dateWritten) {
      action = "date_written";
    } else {
      action = "date_type_only";
    }
  } else {
    action = "contact_only";
  }

  return {
    file: row.file,
    action,
    dateWritten,
    dateTypeWritten,
    contactWritten,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const targetArg = args.find((a) => a.startsWith("--target="));
  const target = targetArg?.split("=")[1] ?? "both";

  if (!["dataset", "knowledge", "both"].includes(target)) {
    console.error(
      `Invalid target: ${target}. Use "dataset", "knowledge", or "both".`,
    );
    process.exit(1);
  }

  const datasetDir = detectLatestDatasetDir();

  console.log(`Mode: ${dryRun ? "DRY RUN" : "WRITE"}`);
  console.log(`Target: ${target}`);
  if (target === "dataset" || target === "both") {
    console.log(`Dataset dir: ${datasetDir}`);
  }
  if (target === "knowledge" || target === "both") {
    console.log(`Knowledge dir: ${KNOWLEDGE_DIR}`);
  }
  console.log("");

  // Parse TSV
  const rows = parseTsv(TSV_PATH);
  console.log(`TSV entries: ${rows.length}\n`);

  const targetDirs: string[] = [];
  if (target === "dataset" || target === "both") targetDirs.push(datasetDir);
  if (target === "knowledge" || target === "both")
    targetDirs.push(KNOWLEDGE_DIR);

  const summary: Summary = {
    dateExact: 0,
    dateEstimated: 0,
    dateObserved: 0,
    dateTypeEvergreen: 0,
    contactWritten: 0,
    skipped: 0,
    total: rows.length,
  };

  // Track which files have been processed (avoid double-counting in summary)
  const processedFiles = new Set<string>();

  for (const dir of targetDirs) {
    // Verify directory has MD files
    const mdFiles = glob.sync(`${dir}/**/*.md`);
    if (mdFiles.length === 0) {
      console.log(`Warning: No .md files found in ${dir}\n`);
      continue;
    }

    console.log(`--- Processing: ${dir} (${mdFiles.length} files) ---`);

    for (const row of rows) {
      const result = processFile(row, dir, dryRun);

      if (!result) continue; // File not found in this directory

      // Log each change
      if (result.action !== "skipped") {
        const parts: string[] = [];
        if (result.dateWritten) parts.push(`date=${result.dateWritten}`);
        if (result.dateTypeWritten)
          parts.push(`date_type=${result.dateTypeWritten}`);
        if (result.contactWritten)
          parts.push(`contact=${result.contactWritten}`);
        console.log(
          `  ${result.action}: ${result.file} -> ${parts.join(", ")}`,
        );
      }

      // Count for summary (only once per file)
      if (!processedFiles.has(result.file)) {
        processedFiles.add(result.file);

        if (result.action === "skipped") {
          summary.skipped++;
        } else {
          // Count date
          if (result.dateWritten) {
            if (result.dateTypeWritten === "exact") {
              summary.dateExact++;
            } else if (result.dateTypeWritten === "estimated") {
              summary.dateEstimated++;
            } else if (result.dateTypeWritten === "observed") {
              summary.dateObserved++;
            }
          } else if (
            result.dateTypeWritten === "evergreen" &&
            !result.dateWritten
          ) {
            summary.dateTypeEvergreen++;
          }

          // Count contact
          if (result.contactWritten) {
            summary.contactWritten++;
          }

          // If only contact was written (no date change), don't count as skipped
          if (
            !result.dateWritten &&
            !result.dateTypeWritten &&
            !result.contactWritten
          ) {
            summary.skipped++;
          }
        }
      }
    }

    console.log("");
  }

  // Files in TSV not found in any target directory
  const notProcessed = rows.filter((r) => !processedFiles.has(r.file));
  if (notProcessed.length > 0) {
    summary.skipped += notProcessed.length;
  }

  // Summary
  const dateTotal =
    summary.dateExact + summary.dateEstimated + summary.dateObserved;
  console.log("--- Apply Summary ---");
  console.log(
    `  date 書き込み:      ${dateTotal}件（exact: ${summary.dateExact}, estimated: ${summary.dateEstimated}, observed: ${summary.dateObserved}）`,
  );
  console.log(
    `  date_type のみ:     ${summary.dateTypeEvergreen}件（evergreen: ${summary.dateTypeEvergreen}）`,
  );
  console.log(`  contact 書き込み:   ${summary.contactWritten}件`);
  console.log(`  スキップ:           ${summary.skipped}件`);
  console.log(`  合計:               ${summary.total}件`);
}

main();
