import { execSync } from "node:child_process";
import { basename } from "node:path";
import { glob } from "glob";

const KNOWLEDGE_DIR = "./knowledge";
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const VECTORIZE_INDEX_NAME = process.env.VECTORIZE_INDEX_NAME;

const validateEnv = () => {
  const missing: string[] = [];
  if (!CLOUDFLARE_ACCOUNT_ID) missing.push("CLOUDFLARE_ACCOUNT_ID");
  if (!R2_BUCKET_NAME) missing.push("R2_BUCKET_NAME");
  if (!VECTORIZE_INDEX_NAME) missing.push("VECTORIZE_INDEX_NAME");

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
  --clean           Vectorizeのナレッジを全削除（wrangler経由）
  --file=<filename> 特定のファイルのみアップロード
  --help, -h        ヘルプを表示

Environment Variables (required):
  CLOUDFLARE_ACCOUNT_ID  Cloudflare アカウント ID
  R2_BUCKET_NAME         R2 バケット名
  VECTORIZE_INDEX_NAME   Vectorize インデックス名

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

const deleteVectorizeIndex = (): boolean => {
  try {
    console.log(`  Deleting Vectorize index: ${VECTORIZE_INDEX_NAME}`);

    // wrangler vectorize delete でインデックスを削除
    // -y フラグで確認をスキップ
    execSync(
      `CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID} wrangler vectorize delete ${VECTORIZE_INDEX_NAME} -y`,
      { stdio: "pipe" },
    );

    console.log("  Index deleted. Recreating...");

    // インデックスを再作成（1536次元、cosine類似度）
    execSync(
      `CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID} wrangler vectorize create ${VECTORIZE_INDEX_NAME} --dimensions=1536 --metric=cosine`,
      { stdio: "pipe" },
    );

    console.log("  Index recreated successfully");
    return true;
  } catch (error) {
    console.error(
      "  Failed to reset Vectorize index:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
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

    const success = deleteVectorizeIndex();
    if (success) {
      console.log("\n=== Clean Complete ===");
    } else {
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
