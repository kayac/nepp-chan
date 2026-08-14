import { execSync } from "node:child_process";
import { glob } from "glob";

const KNOWLEDGE_DIR = "./knowledge";
const CLOUDFLARE_ACCOUNT_ID = "51544998e04526c4d6cc9e3e08653361";

const ENVIRONMENTS = {
  local: {
    bucket: "nepp-chan-knowledge-local",
    index: "nepp-chan-knowledge-local",
  },
  dev: {
    bucket: "nepp-chan-knowledge-dev",
    index: "nepp-chan-knowledge-dev",
  },
  prd: {
    bucket: "nepp-chan-knowledge-prd",
    index: "nepp-chan-knowledge-prd",
  },
} as const;

type EnvName = keyof typeof ENVIRONMENTS;
type Target = (typeof ENVIRONMENTS)[EnvName];

const isEnvName = (value: string | undefined): value is EnvName =>
  value !== undefined && value in ENVIRONMENTS;

const parseArgs = () => {
  const args = process.argv.slice(2);
  return {
    env: args.find((arg) => arg.startsWith("--env="))?.split("=")[1],
    clean: args.includes("--clean"),
    file: args.find((arg) => arg.startsWith("--file="))?.split("=")[1],
    help: args.includes("--help") || args.includes("-h"),
  };
};

const printUsage = () => {
  console.log(`
Usage: pnpm knowledge:upload:<local|dev|prd> [options]

Options:
  --clean           Vectorizeのナレッジを全削除（wrangler経由）
  --file=<filename> 特定のファイルのみアップロード
  --help, -h        ヘルプを表示

Examples:
  pnpm knowledge:upload:dev                    # 全ファイルをR2にアップロード
  pnpm knowledge:upload:dev --file=foo.md      # 特定ファイルのみ
  pnpm knowledge:upload:dev --clean            # 全ナレッジを削除

Note:
  R2へのアップロード後、R2 Event Notificationsにより
  自動的にVectorizeへの同期が行われます。
`);
};

const uploadToR2 = (target: Target, filepath: string, key: string): boolean => {
  try {
    console.log(`  Uploading to R2: ${key}`);
    execSync(
      `CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID} wrangler r2 object put ${target.bucket}/${key} --file="${filepath}" --remote`,
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

const deleteVectorizeIndex = (target: Target): boolean => {
  try {
    console.log(`  Deleting Vectorize index: ${target.index}`);

    // wrangler vectorize delete でインデックスを削除
    // -y フラグで確認をスキップ
    execSync(
      `CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID} wrangler vectorize delete ${target.index} -y`,
      { stdio: "pipe" },
    );

    console.log("  Index deleted. Recreating...");

    // インデックスを再作成（1536次元、cosine類似度）
    execSync(
      `CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID} wrangler vectorize create ${target.index} --dimensions=1536 --metric=cosine`,
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

  if (!isEnvName(args.env)) {
    console.error(
      `Error: --env には local、dev、prd のいずれかを指定してください: ${args.env ?? "未指定"}`,
    );
    process.exit(1);
  }

  const target = ENVIRONMENTS[args.env];
  console.log(`Target: ${args.env} (${target.bucket})\n`);

  if (args.clean) {
    console.log("=== Knowledge Clean Script ===\n");

    const success = deleteVectorizeIndex(target);
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
    const key = filepath.replace("knowledge/", "");
    if (uploadToR2(target, filepath, key)) {
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
