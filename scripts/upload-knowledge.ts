import { execSync } from "node:child_process";
import { basename } from "node:path";
import { glob } from "glob";

const KNOWLEDGE_DIR = "./knowledge";
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const API_BASE_URL = process.env.API_URL || "http://localhost:8787";
const ADMIN_KEY = process.env.ADMIN_KEY;

type DeleteResponse = {
  success: boolean;
  message: string;
  count?: number;
};

const validateEnv = () => {
  const missing: string[] = [];
  if (!CLOUDFLARE_ACCOUNT_ID) missing.push("CLOUDFLARE_ACCOUNT_ID");
  if (!R2_BUCKET_NAME) missing.push("R2_BUCKET_NAME");

  if (missing.length > 0) {
    console.error(
      `Error: Missing required environment variables: ${missing.join(", ")}`,
    );
    console.error(
      "Please set them in .env file or export them before running this script.",
    );
    process.exit(1);
  }
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

Environment Variables (required):
  CLOUDFLARE_ACCOUNT_ID  Cloudflare アカウント ID
  R2_BUCKET_NAME         R2 バケット名

Environment Variables (optional):
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

  validateEnv();

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
