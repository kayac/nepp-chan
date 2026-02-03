#!/usr/bin/env tsx
/**
 * 管理者招待を作成するCLIスクリプト
 *
 * 使用方法:
 *   pnpm admin:invite:local <email> [--role=admin|super_admin] [--days=7]
 *   pnpm admin:invite:dev <email> [--role=admin|super_admin] [--days=7] [--local]
 *   pnpm admin:invite:prd <email> [--role=admin|super_admin] [--days=7] [--local]
 *
 * 例:
 *   pnpm admin:invite:local admin@example.com
 *   pnpm admin:invite:dev admin@example.com
 *   pnpm admin:invite:prd admin@example.com
 */

import { execSync } from "node:child_process";

import { generateId, generateToken } from "../src/lib/crypto";

const parseArgs = (args: string[]) => {
  const email = args.find((arg) => !arg.startsWith("--"));
  const roleArg = args.find((arg) => arg.startsWith("--role="));
  const daysArg = args.find((arg) => arg.startsWith("--days="));
  const envArg = args.find((arg) => arg.startsWith("--env="));
  const env = envArg?.split("=")[1] as "dev" | "prd" | undefined;
  const isLocal = args.includes("--local");

  return {
    email,
    role: roleArg?.split("=")[1] || "super_admin",
    days: Number.parseInt(daysArg?.split("=")[1] || "7", 10),
    env,
    isRemote: env ? !isLocal : false,
  };
};

const main = async () => {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
管理者招待を作成するCLIスクリプト

使用方法:
  pnpm admin:invite:local <email> [options]  # ローカル環境
  pnpm admin:invite:dev <email> [options]    # dev環境（リモートD1）
  pnpm admin:invite:prd <email> [options]    # prd環境（リモートD1）

オプション:
  --role=<role>   役割 (admin または super_admin、デフォルト: super_admin)
  --days=<days>   有効期限日数 (デフォルト: 7日)
  --local         ローカルD1に対して実行 (dev/prdのデフォルトはリモート)
  --help, -h      このヘルプを表示

例:
  pnpm admin:invite:local admin@example.com
  pnpm admin:invite:dev admin@example.com
  pnpm admin:invite:prd admin@example.com
`);
    process.exit(0);
  }

  const { email, role, days, env, isRemote } = parseArgs(args);

  if (!email || !email.includes("@")) {
    console.error("❌ 有効なメールアドレスを指定してください");
    process.exit(1);
  }

  if (!["admin", "super_admin"].includes(role)) {
    console.error("❌ 役割は admin または super_admin を指定してください");
    process.exit(1);
  }

  if (env && !["dev", "prd"].includes(env)) {
    console.error("❌ 環境は dev または prd を指定してください");
    process.exit(1);
  }

  const dbName = `nepp-chan-db-${env || "dev"}`;

  const id = generateId();
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const sql = `
INSERT INTO admin_invitations (id, email, token, invited_by, role, expires_at, created_at)
VALUES ('${id}', '${email}', '${token}', 'system', '${role}', '${expiresAt.toISOString()}', '${now.toISOString()}');
`.trim();

  const envLabel = env
    ? `${env} (${isRemote ? "リモート" : "ローカル"})`
    : "local";
  console.log(`\n📧 招待を作成しています...`);
  console.log(`   メール: ${email}`);
  console.log(`   役割: ${role}`);
  console.log(`   有効期限: ${days}日`);
  console.log(`   環境: ${envLabel}`);
  console.log(`   DB: ${dbName}\n`);

  try {
    const remoteFlag = isRemote ? "--remote" : "--local";
    const command = `wrangler d1 execute ${dbName} ${remoteFlag} --config=server/wrangler.jsonc --command="${sql}"`;

    execSync(command, { stdio: "inherit" });

    const targetUrl = process.env.WEB_URL || "http://localhost:5173";

    console.log(`\n✅ 招待が作成されました！`);
    console.log(`\n📎 登録URL:`);
    console.log(`   ${targetUrl}/register?token=${token}`);
    console.log(`\n⏰ 有効期限: ${expiresAt.toLocaleString("ja-JP")}`);
    console.log(`\n💡 このURLを招待したい人に共有してください。\n`);
  } catch (error) {
    console.error("\n❌ 招待の作成に失敗しました");
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
};

main();
