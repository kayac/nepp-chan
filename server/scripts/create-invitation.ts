#!/usr/bin/env tsx
/**
 * 管理者招待を作成するCLIスクリプト
 *
 * 使用方法:
 *   pnpm admin:invite <email> [--role=admin|super_admin] [--days=7] [--remote]
 *
 * 例:
 *   pnpm admin:invite admin@example.com
 *   pnpm admin:invite admin@example.com --role=super_admin --days=7
 *   pnpm admin:invite admin@example.com --remote
 */

import { execSync } from "node:child_process";

import { generateId, generateToken } from "../src/lib/crypto";

const parseArgs = (args: string[]) => {
  const email = args.find((arg) => !arg.startsWith("--"));
  const roleArg = args.find((arg) => arg.startsWith("--role="));
  const daysArg = args.find((arg) => arg.startsWith("--days="));
  const isRemote = args.includes("--remote");

  return {
    email,
    role: roleArg?.split("=")[1] || "admin",
    days: Number.parseInt(daysArg?.split("=")[1] || "7", 10),
    isRemote,
  };
};

const main = async () => {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
管理者招待を作成するCLIスクリプト

使用方法:
  pnpm admin:invite <email> [options]

オプション:
  --role=<role>   役割 (admin または super_admin、デフォルト: admin)
  --days=<days>   有効期限日数 (デフォルト: 7日)
  --remote        リモートD1に対して実行 (デフォルト: ローカル)
  --help, -h      このヘルプを表示

例:
  pnpm admin:invite admin@example.com
  pnpm admin:invite admin@example.com --role=super_admin --days=7
  pnpm admin:invite admin@example.com --remote
`);
    process.exit(0);
  }

  const { email, role, days, isRemote } = parseArgs(args);

  if (!email || !email.includes("@")) {
    console.error("❌ 有効なメールアドレスを指定してください");
    process.exit(1);
  }

  if (!["admin", "super_admin"].includes(role)) {
    console.error("❌ 役割は admin または super_admin を指定してください");
    process.exit(1);
  }

  const id = generateId();
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const sql = `
INSERT INTO admin_invitations (id, email, token, invited_by, role, expires_at, created_at)
VALUES ('${id}', '${email}', '${token}', 'system', '${role}', '${expiresAt.toISOString()}', '${now.toISOString()}');
`.trim();

  console.log(`\n📧 招待を作成しています...`);
  console.log(`   メール: ${email}`);
  console.log(`   役割: ${role}`);
  console.log(`   有効期限: ${days}日`);
  console.log(`   環境: ${isRemote ? "リモート" : "ローカル"}\n`);

  try {
    const remoteFlag = isRemote ? "--remote" : "--local";
    const command = `wrangler d1 execute nepp-chan-db-dev ${remoteFlag} --command="${sql}"`;

    execSync(command, { stdio: "inherit", cwd: process.cwd() });

    const prodUrl = process.env.PRODUCTION_WEB_URL || "https://your-domain.com";
    console.log(`\n✅ 招待が作成されました！`);
    console.log(`\n📎 登録URL:`);
    console.log(`   ローカル: http://localhost:5173/register?token=${token}`);
    console.log(`   本番: ${prodUrl}/register?token=${token}`);
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
