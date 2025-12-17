import { execSync } from "node:child_process";
import { basename } from "node:path";
import { glob } from "glob";

// 設定
const KNOWLEDGE_DIR = "./knowledge";
const API_BASE_URL = process.env.API_URL || "http://localhost:8787";
const ADMIN_KEY = process.env.ADMIN_KEY;
const R2_BUCKET_NAME = "aiss-nepch-knowledge";
const CLOUDFLARE_ACCOUNT_ID = "51544998e04526c4d6cc9e3e08653361";

type SyncResponse = {
  success: boolean;
  message: string;
  processedFiles?: number;
  totalChunks?: number;
  errors?: string[];
};

type DeleteResponse = {
  success: boolean;
  message: string;
  count?: number;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  return {
    uploadOnly: args.includes("--upload-only"),
    syncOnly: args.includes("--sync-only"),
    clean: args.includes("--clean"),
    file: args.find((arg) => arg.startsWith("--file="))?.split("=")[1],
    help: args.includes("--help") || args.includes("-h"),
  };
};

const printUsage = () => {
  console.log(`
Usage: pnpm run knowledge:upload [options]

Options:
  --upload-only     R2へのアップロードのみ実行（sync APIを呼ばない）
  --sync-only       sync APIの呼び出しのみ実行（R2へのアップロードをスキップ）
  --clean           Vectorizeのナレッジを全削除
  --file=<filename> 特定のファイルのみ処理
  --help, -h        ヘルプを表示

Environment Variables:
  API_URL           APIのベースURL (default: http://localhost:8787)
  ADMIN_KEY         管理API認証キー (required for sync/clean)

Examples:
  pnpm knowledge:upload                    # 全ファイルをR2にアップロードして同期
  pnpm knowledge:upload --file=foo.md      # 特定ファイルのみ
  pnpm knowledge:upload --upload-only      # R2アップロードのみ
  pnpm knowledge:upload --sync-only        # sync APIのみ
  pnpm knowledge:upload --clean            # 全ナレッジを削除
`);
};

/**
 * wrangler コマンドで R2 にファイルをアップロード
 */
const uploadToR2 = (filepath: string, key: string): boolean => {
  try {
    console.log(`  Uploading to R2: ${key}`);
    execSync(
      `CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID} wrangler r2 object put ${R2_BUCKET_NAME}/${key} --file="${filepath}" --remote`,
      { stdio: "pipe" },
    );
    return true;
  } catch (error) {
    console.error(
      `  Failed to upload ${key}:`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
};

/**
 * sync API を呼び出し
 */
const callSyncApi = async (source?: string): Promise<SyncResponse> => {
  if (!ADMIN_KEY) {
    throw new Error("ADMIN_KEY environment variable is required");
  }

  const url = source
    ? `${API_BASE_URL}/admin/knowledge/sync/${encodeURIComponent(source)}`
    : `${API_BASE_URL}/admin/knowledge/sync`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Admin-Key": ADMIN_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Sync API failed: ${response.status} ${error}`);
  }

  return (await response.json()) as SyncResponse;
};

/**
 * delete API を呼び出し
 */
const callDeleteApi = async (): Promise<DeleteResponse> => {
  if (!ADMIN_KEY) {
    throw new Error("ADMIN_KEY environment variable is required");
  }

  const response = await fetch(`${API_BASE_URL}/admin/knowledge`, {
    method: "DELETE",
    headers: {
      "X-Admin-Key": ADMIN_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Delete API failed: ${response.status} ${error}`);
  }

  return (await response.json()) as DeleteResponse;
};

const main = async () => {
  const args = parseArgs();

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  // --clean オプションの処理
  if (args.clean) {
    console.log("=== Knowledge Clean Script ===\n");

    if (!ADMIN_KEY) {
      console.error("Error: ADMIN_KEY environment variable is required");
      process.exit(1);
    }

    try {
      const result = await callDeleteApi();
      console.log(`Result: ${result.message}`);
      if (result.count !== undefined) {
        console.log(`  Deleted: ${result.count} vectors`);
      }
      console.log("\n=== Clean Complete ===");
    } catch (error) {
      console.error(
        "Clean failed:",
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
    return;
  }

  console.log("=== Knowledge Upload Script ===\n");

  // R2 へのアップロード
  if (!args.syncOnly) {
    console.log("Step 1: Uploading files to R2...\n");

    const pattern = args.file
      ? `${KNOWLEDGE_DIR}/${args.file}`
      : `${KNOWLEDGE_DIR}/**/*.md`;

    const files = await glob(pattern);

    if (files.length === 0) {
      console.log(`No markdown files found in ${KNOWLEDGE_DIR}`);
      if (!args.uploadOnly) {
        console.log("\nSkipping sync (no files to process)");
      }
      process.exit(0);
    }

    console.log(`Found ${files.length} file(s)`);

    let uploadedCount = 0;
    for (const filepath of files) {
      const key = basename(filepath);
      if (uploadToR2(filepath, key)) {
        uploadedCount++;
      }
    }

    console.log(`\nUploaded ${uploadedCount}/${files.length} files to R2\n`);

    if (args.uploadOnly) {
      console.log("=== Upload Complete (sync skipped) ===");
      process.exit(0);
    }
  }

  // sync API の呼び出し
  console.log("Step 2: Calling sync API...\n");

  if (!ADMIN_KEY) {
    console.error("Error: ADMIN_KEY environment variable is required for sync");
    process.exit(1);
  }

  try {
    const result = await callSyncApi(args.file);

    console.log(`Result: ${result.message}`);
    if (result.processedFiles !== undefined) {
      console.log(`  Processed files: ${result.processedFiles}`);
    }
    if (result.totalChunks !== undefined) {
      console.log(`  Total chunks: ${result.totalChunks}`);
    }
    if (result.errors && result.errors.length > 0) {
      console.log(`  Errors:`);
      for (const error of result.errors) {
        console.log(`    - ${error}`);
      }
    }

    console.log("\n=== Sync Complete ===");
  } catch (error) {
    console.error(
      "Sync failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
