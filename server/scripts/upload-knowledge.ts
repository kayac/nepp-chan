import { execSync } from "node:child_process";
import { basename } from "node:path";
import { glob } from "glob";

// 設定
const KNOWLEDGE_DIR = "./knowledge";
const API_BASE_URL = process.env.API_URL || "http://localhost:8787";
const ADMIN_KEY = process.env.ADMIN_KEY;
const R2_BUCKET_NAME = "aiss-nepch-knowledge";
const CLOUDFLARE_ACCOUNT_ID = "51544998e04526c4d6cc9e3e08653361";

type DeleteResponse = {
  success: boolean;
  message: string;
  count?: number;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  return {
    clean: args.includes("--clean"),
    file: args.find((arg) => arg.startsWith("--file="))?.split("=")[1],
    help: args.includes("--help") || args.includes("-h"),
  };
};

const printUsage = () => {
  console.log(`
Usage: pnpm run knowledge:upload [options]

Options:
  --clean           Vectorizeのナレッジを全削除
  --file=<filename> 特定のファイルのみアップロード
  --help, -h        ヘルプを表示

Environment Variables:
  API_URL           APIのベースURL (default: http://localhost:8787)
  ADMIN_KEY         管理API認証キー (required for --clean)

Examples:
  pnpm knowledge:upload                    # 全ファイルをR2にアップロード
  pnpm knowledge:upload --file=foo.md      # 特定ファイルのみ
  pnpm knowledge:upload --clean            # 全ナレッジを削除

Note:
  R2へのアップロード後、R2 Event Notificationsにより
  自動的にVectorizeへの同期が行われます。
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
  console.log("Uploading files to R2...\n");

  const pattern = args.file
    ? `${KNOWLEDGE_DIR}/${args.file}`
    : `${KNOWLEDGE_DIR}/**/*.md`;

  const files = await glob(pattern);

  if (files.length === 0) {
    console.log(`No markdown files found in ${KNOWLEDGE_DIR}`);
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

  console.log(`\nUploaded ${uploadedCount}/${files.length} files to R2`);
  console.log(
    "\nNote: Vectorize sync will be triggered automatically via R2 Event Notifications",
  );
  console.log("\n=== Upload Complete ===");
};

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
