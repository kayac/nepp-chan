import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { glob } from "glob";

const KNOWLEDGE_DIR = "./knowledge";

/**
 * 除外パス（テーブル変換しないディレクトリ/ファイル）
 */
const EXCLUDED_PATHS: string[] = [];

/**
 * リンク集テーブルの判定: セルの過半数が [text](url) パターンの場合は変換しない
 */
const isLinkTable = (rows: string[][]): boolean => {
  const linkPattern = /\[.+?\]\(.+?\)/;
  let linkCellCount = 0;
  let totalCells = 0;

  for (const row of rows) {
    for (const cell of row) {
      totalCells++;
      if (linkPattern.test(cell)) {
        linkCellCount++;
      }
    }
  }

  return totalCells > 0 && linkCellCount / totalCells > 0.5;
};

interface TableMatch {
  startLine: number; // ヘッダー行の行番号
  endLine: number; // 最後のデータ行の行番号（exclusive）
  headers: string[];
  rows: string[][];
}

/**
 * Markdown テーブルを検出してパース
 */
const findTables = (lines: string[]): TableMatch[] => {
  const tables: TableMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    // セパレータ行を検出: |---|---| のようなパターン
    const isSeparator = /^\s*\|[\s:]*-{2,}[\s:]*\|/.test(lines[i]);
    if (!isSeparator) continue;

    // セパレータの直前がヘッダー行
    if (i === 0) continue;
    const headerLine = lines[i - 1];
    if (!headerLine.includes("|")) continue;

    // ヘッダーをパース
    const headers = parseCells(headerLine);
    if (headers.length === 0) continue;

    // セパレータの直後からデータ行を収集
    const rows: string[][] = [];
    let endLine = i + 1;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      // テーブル行でなくなったら終了
      if (!line.trim().startsWith("|")) break;
      // 新しいセパレータ行（別テーブルの可能性）は含めない
      if (/^\s*\|[\s:]*-{2,}[\s:]*\|/.test(line)) break;

      const cells = parseCells(line);
      if (cells.length > 0) {
        rows.push(cells);
      }
      endLine = j + 1;
    }

    if (rows.length > 0) {
      tables.push({
        startLine: i - 1, // ヘッダー行
        endLine,
        headers,
        rows,
      });
    }
  }

  return tables;
};

/**
 * テーブル行をセルに分割
 */
const parseCells = (line: string): string[] => {
  // 先頭と末尾の | を除去してから分割
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
};

/**
 * テーブルを JSON ブロックに変換
 */
const tableToJson = (table: TableMatch): string => {
  const jsonArray = table.rows.map((row) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < table.headers.length; i++) {
      const key = table.headers[i];
      const value = row[i] ?? "";
      if (key) {
        obj[key] = value;
      }
    }
    return obj;
  });

  return `\`\`\`json\n${JSON.stringify(jsonArray, null, 2)}\n\`\`\``;
};

/**
 * ファイル内のテーブルを JSON ブロックに変換
 */
const convertFile = (
  filepath: string,
  dryRun: boolean,
): { converted: number; skipped: number } => {
  const content = readFileSync(filepath, "utf-8");
  const lines = content.split("\n");
  const tables = findTables(lines);

  if (tables.length === 0) {
    return { converted: 0, skipped: 0 };
  }

  let converted = 0;
  let skipped = 0;

  // 後ろから処理して行番号のずれを防ぐ
  const sortedTables = [...tables].sort((a, b) => b.startLine - a.startLine);

  for (const table of sortedTables) {
    // リンク集テーブルは変換しない
    if (isLinkTable(table.rows)) {
      skipped++;
      if (dryRun) {
        console.log(
          `    [SKIP] Link table at line ${table.startLine + 1} (${table.rows.length} rows)`,
        );
      }
      continue;
    }

    const jsonBlock = tableToJson(table);

    if (dryRun) {
      console.log(
        `    [CONVERT] Table at line ${table.startLine + 1}: ${table.headers.join(" | ")} (${table.rows.length} rows)`,
      );
      // JSON の最初の2行だけプレビュー
      const preview = jsonBlock.split("\n").slice(0, 4).join("\n");
      console.log(`      Preview: ${preview}...`);
    }

    // テーブル行を JSON ブロックで置換
    const jsonLines = jsonBlock.split("\n");
    lines.splice(
      table.startLine,
      table.endLine - table.startLine,
      ...jsonLines,
    );
    converted++;
  }

  if (!dryRun && converted > 0) {
    writeFileSync(filepath, lines.join("\n"), "utf-8");
  }

  return { converted, skipped };
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    file: args.find((arg) => arg.startsWith("--file="))?.split("=")[1],
    help: args.includes("--help") || args.includes("-h"),
  };
};

const printUsage = () => {
  console.log(`
Usage: pnpm exec tsx scripts/convert-tables-to-json.ts [options]

Options:
  --dry-run           変換プレビュー（ファイル書き込みなし）
  --file=<path>       特定ファイルのみ変換（knowledge/ からの相対パス）
  --help, -h          ヘルプを表示

Examples:
  pnpm exec tsx scripts/convert-tables-to-json.ts --dry-run
  pnpm exec tsx scripts/convert-tables-to-json.ts --file=villotoinep/shisetsu/sports/ski.md
  pnpm exec tsx scripts/convert-tables-to-json.ts
`);
};

const main = async () => {
  const args = parseArgs();

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  console.log(
    `=== Table → JSON Conversion ${args.dryRun ? "(DRY RUN)" : ""} ===\n`,
  );

  // ファイル一覧取得
  const pattern = args.file
    ? `${KNOWLEDGE_DIR}/${args.file}`
    : `${KNOWLEDGE_DIR}/**/*.md`;

  const files = await glob(pattern);

  if (files.length === 0) {
    console.log("No markdown files found.");
    process.exit(0);
  }

  let totalConverted = 0;
  let totalSkipped = 0;
  let filesModified = 0;
  let filesSkippedByExclusion = 0;

  for (const filepath of files) {
    const relPath = relative(KNOWLEDGE_DIR, filepath);

    // 除外パスチェック
    if (EXCLUDED_PATHS.some((p) => relPath.startsWith(p))) {
      filesSkippedByExclusion++;
      continue;
    }

    const { converted, skipped } = convertFile(filepath, args.dryRun);

    if (converted > 0 || skipped > 0) {
      console.log(
        `  ${relPath}: ${converted} converted, ${skipped} skipped`,
      );
      if (converted > 0) filesModified++;
    }

    totalConverted += converted;
    totalSkipped += skipped;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Files scanned: ${files.length}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Files excluded: ${filesSkippedByExclusion}`);
  console.log(`Tables converted: ${totalConverted}`);
  console.log(`Tables skipped (link tables): ${totalSkipped}`);

  if (args.dryRun) {
    console.log(`\nThis was a dry run. No files were modified.`);
    console.log(
      `Run without --dry-run to apply changes.`,
    );
  }
};

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
