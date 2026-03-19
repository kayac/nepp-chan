import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, relative } from "node:path";
import { glob } from "glob";
import matter from "gray-matter";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const KNOWLEDGE_DIR = "./knowledge";
const DATASET_DIR = "./dataset/v4/src";

/** villotoinep/ 第1レベルのカテゴリマッピング */
const VILLOTOINEP_MAPPING: Record<
  string,
  { category: string; subcategory?: string }
> = {
  kurashi: { category: "住民生活" },
  gyousei: { category: "行政" },
  shisetsu: { category: "施設案内" },
  sangyou: { category: "産業" },
  bousai: { category: "防災" },
  lifeevent: { category: "ライフイベント" },
  village_mayor: { category: "村長の部屋" },
  about: { category: "村の概要" },
  kakuka: { category: "各課案内" },
  index: { category: "村の概要" },
  pdf: { category: "資料" },
};

/** villotoinep/kakuka/ 第2レベルの subcategory */
const KAKUKA_SUBCATEGORY: Record<string, string> = {
  chiikishinkou: "地域振興課",
  chutonjo: "駐在所",
  gikaijimu: "議会事務局",
  hokenfukushi: "保健福祉課",
  juuminseikatsu: "住民生活課",
  kankyouseibi: "環境整備課",
  kyouikuiin: "教育委員会",
  nougyouiin: "農業委員会",
  sangyoushinkou: "産業振興課",
  senkyokanri: "選挙管理委員会",
  soumuzaisei: "総務財政課",
  suitoushitsu: "出納室",
  syoubou: "消防",
};

/** villotoinep/kurashi/ 第2レベルの subcategory */
const KURASHI_SUBCATEGORY: Record<string, string> = {
  gomi_kankyou: "ごみ・環境",
  hoken_nenkin: "保険・年金",
  kenkou_fukushi: "健康・福祉",
  manabi: "教育・学び",
  tetsuduki: "手続き",
  zeikin: "税金",
};

/** otoko/ のディレクトリ別 subcategory（category は全て「教育」） */
const OTOKO_SUBCATEGORY: Record<string, string> = {
  entrance: "入試",
  event: "イベント",
  gakkoudayori: "学校便り",
  gallery: "ギャラリー",
  junior: "中学生向け",
  ryou: "寮",
  seikatsu: "学校生活",
  contact: "問合せ",
  index: "総合",
};

/** otoko URL のベースURL（検証済み: 100% 成功） */
const OTOKO_BASE_URL = "https://www.otoineppu-h.ed.jp";

// ---------------------------------------------------------------------------
// Category resolution
// ---------------------------------------------------------------------------

interface CategoryResult {
  category: string;
  subcategory?: string;
}

function resolveCategory(relPath: string): CategoryResult {
  const parts = relPath.split("/");

  // Root-level files (e.g., welcome-guide.md)
  if (parts.length === 1) {
    return { category: "移住" };
  }

  const topLevel = parts[0]; // "otoko" | "villotoinep"

  if (topLevel === "otoko") {
    const section = parts[1]; // "entrance" | "event" | ...
    const subcategory = OTOKO_SUBCATEGORY[section] ?? "その他";
    return { category: "教育", subcategory };
  }

  if (topLevel === "villotoinep") {
    const section = parts[1]; // "kurashi" | "gyousei" | ...

    // kakuka has 2nd level subcategory
    if (section === "kakuka" && parts.length >= 3) {
      const dept = parts[2];
      const subcategory = KAKUKA_SUBCATEGORY[dept] ?? dept;
      return { category: "各課案内", subcategory };
    }

    // kurashi has 2nd level subcategory
    if (section === "kurashi" && parts.length >= 3) {
      const topic = parts[2];
      const subcategory = KURASHI_SUBCATEGORY[topic] ?? topic;
      return { category: "住民生活", subcategory };
    }

    const mapping = VILLOTOINEP_MAPPING[section];
    if (mapping) {
      return { category: mapping.category, subcategory: mapping.subcategory };
    }

    return { category: "その他" };
  }

  return { category: "その他" };
}

// ---------------------------------------------------------------------------
// Title extraction
// ---------------------------------------------------------------------------

function extractTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

// ---------------------------------------------------------------------------
// URL inference
// ---------------------------------------------------------------------------

/**
 * otoko/ のURL推測（検証済み: 成功率 100%）
 * タイムスタンプ系ファイル名もそのまま .html 変換で元URLを復元可能
 */
function inferOtokoUrl(relPath: string): string {
  const pathWithoutTop = relPath.replace(/^otoko\//, "");
  const filename = basename(pathWithoutTop, ".md");
  const dir = dirname(pathWithoutTop);

  if (filename === "index") {
    const urlPath = dir === "." ? "" : `/${dir}`;
    return `${OTOKO_BASE_URL}${urlPath}/`;
  }

  const dirPath = dir === "." ? "" : `/${dir}`;
  return `${OTOKO_BASE_URL}${dirPath}/${filename}.html`;
}

/**
 * URL推測（otoko のみ。villotoinep は成功率 50% のため付与しない）
 */
function inferUrl(relPath: string): string | undefined {
  const topLevel = relPath.split("/")[0];

  if (topLevel === "otoko") {
    return inferOtokoUrl(relPath);
  }

  // villotoinep: URL推測の成功率が 50% のため付与しない
  // about/, kurashi/gomi_kankyou/, kakuka/ は成功するが
  // kurashi/zeikin/, gyousei/, shisetsu/ は 302→404 になる
  return undefined;
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

interface ProcessResult {
  file: string;
  action: "added" | "merged" | "skipped";
  fields: Record<string, string>;
}

function processFile(
  filePath: string,
  targetDir: string,
  dryRun: boolean,
): ProcessResult {
  const raw = readFileSync(filePath, "utf-8");
  const { data: existing, content } = matter(raw);
  const relPath = relative(targetDir, filePath);

  // Resolve category
  const { category, subcategory } = resolveCategory(relPath);

  // Extract title from # heading
  const title = extractTitle(content);

  // Infer URL
  const url = inferUrl(relPath);

  // Build new frontmatter (don't overwrite existing fields)
  const newFm: Record<string, string> = {};

  if (title && !existing.title) newFm.title = title;
  if (category && !existing.category) newFm.category = category;
  if (subcategory && !existing.subcategory) newFm.subcategory = subcategory;
  if (url && !existing.url) newFm.url = url;

  // Check if there's anything to add
  const hasExisting = Object.keys(existing).length > 0;
  const hasNew = Object.keys(newFm).length > 0;

  if (!hasNew) {
    return { file: relPath, action: "skipped", fields: {} };
  }

  // Merge: existing fields take priority
  const merged = { ...newFm, ...existing };

  if (!dryRun) {
    const output = matter.stringify(content, merged);
    writeFileSync(filePath, output);
  }

  return {
    file: relPath,
    action: hasExisting ? "merged" : "added",
    fields: newFm,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const targetArg = args.find((a) => a.startsWith("--target="));
  const target = targetArg?.split("=")[1] ?? "knowledge";

  const targetDir = target === "dataset" ? DATASET_DIR : KNOWLEDGE_DIR;

  console.log(`Target: ${targetDir}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "WRITE"}`);
  console.log("");

  const files = glob.sync(`${targetDir}/**/*.md`);
  console.log(`Found ${files.length} files\n`);

  const results: ProcessResult[] = [];

  for (const file of files) {
    const result = processFile(file, targetDir, dryRun);
    results.push(result);

    if (result.action !== "skipped") {
      const fieldList = Object.entries(result.fields)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      console.log(`  ${result.action}: ${result.file} → ${fieldList}`);
    }
  }

  // Summary
  const added = results.filter((r) => r.action === "added").length;
  const merged = results.filter((r) => r.action === "merged").length;
  const skipped = results.filter((r) => r.action === "skipped").length;

  console.log("\n--- Summary ---");
  console.log(`  Added:   ${added}`);
  console.log(`  Merged:  ${merged}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${results.length}`);
}

main();
