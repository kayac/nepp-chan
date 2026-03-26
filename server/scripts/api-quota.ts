#!/usr/bin/env tsx
/**
 * API Quota Dashboard
 *
 * プロジェクトで使用している LLM API のクォータ消費状況を CLI で可視化する。
 *
 * 使用方法:
 *   pnpm api:quota
 */
import { execSync } from "node:child_process";
import { getPlatformProxy } from "wrangler";
import {
  type GeminiKeyType,
  getAllGeminiUsage,
  migrateLegacyCounter,
} from "./lib/gemini-counter";

// ─── ユーティリティ ─────────────────────────────────────


// ─── CLI バーグラフ ──────────────────────────────────────

const bar = (used: number, limit: number, width = 25): string => {
  const ratio = Math.min(used / limit, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const pct = (ratio * 100).toFixed(0);

  let color: string;
  if (ratio > 0.8)
    color = "\x1b[31m"; // 赤
  else if (ratio > 0.5)
    color = "\x1b[33m"; // 黄
  else color = "\x1b[32m"; // 緑

  const reset = "\x1b[0m";
  return `${color}${"█".repeat(filled)}${"░".repeat(empty)}${reset} ${used.toLocaleString()} / ${limit.toLocaleString()} (${pct}%)`;
};

// ─── OpenAI ─────────────────────────────────────────────

interface OpenAIQuota {
  limitRequests: number;
  remainingRequests: number;
  limitTokens: number;
  remainingTokens: number;
  resetRequests: string;
  resetTokens: string;
}

const fetchOpenAIQuota = async (
  apiKey: string,
): Promise<OpenAIQuota | null> => {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-nano",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
    });

    return {
      limitRequests: Number(res.headers.get("x-ratelimit-limit-requests") ?? 0),
      remainingRequests: Number(
        res.headers.get("x-ratelimit-remaining-requests") ?? 0,
      ),
      limitTokens: Number(res.headers.get("x-ratelimit-limit-tokens") ?? 0),
      remainingTokens: Number(
        res.headers.get("x-ratelimit-remaining-tokens") ?? 0,
      ),
      resetRequests: res.headers.get("x-ratelimit-reset-requests") ?? "unknown",
      resetTokens: res.headers.get("x-ratelimit-reset-tokens") ?? "unknown",
    };
  } catch (e) {
    console.error("  OpenAI API エラー:", e instanceof Error ? e.message : e);
    return null;
  }
};

// ─── Vectorize ──────────────────────────────────────────

interface VectorizeInfo {
  vectorCount: number;
  processedUpToDatetime: string;
}

const fetchVectorizeInfo = (env: string): VectorizeInfo | null => {
  try {
    const output = execSync(
      `pnpm exec wrangler vectorize info nepp-chan-knowledge-${env} 2>&1`,
      { encoding: "utf-8", timeout: 15000 },
    );
    const countMatch = output.match(/│\s*\d+\s*│\s*(\d+)\s*│/);
    const dateMatch = output.match(/│\s*(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s*│/);
    return {
      vectorCount: countMatch ? Number(countMatch[1]) : 0,
      processedUpToDatetime: dateMatch ? dateMatch[1] : "unknown",
    };
  } catch {
    return null;
  }
};

// ─── メイン ─────────────────────────────────────────────

const main = async () => {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const timestamp = jst.toISOString().replace("T", " ").slice(0, 19);

  const sep = "─".repeat(60);
  const section = (title: string) => {
    console.log("");
    console.log(`  ${title}`);
    console.log(`  ${sep}`);
  };

  console.log(`\n  API Quota Dashboard (${timestamp} JST)`);
  console.log(`  ${"=".repeat(60)}`);

  // ─── Gemini ───
  migrateLegacyCounter();
  const geminiAll = getAllGeminiUsage();
  const geminiResetJST = "17:00 JST";
  const hoursUntilReset = (() => {
    const resetHourUTC = 8; // PT 00:00 = UTC 08:00
    const nowUTC = now.getUTCHours() + now.getUTCMinutes() / 60;
    const diff = resetHourUTC - nowUTC;
    return diff > 0 ? diff : diff + 24;
  })();

  const keyLabels: Record<GeminiKeyType, string> = {
    eval: "Eval専用 (EVAL_GOOGLE_API_KEY)",
    main: "本番会話 (GOOGLE_GENERATIVE_AI_API_KEY)",
  };

  section("Gemini (ローカルカウンター)");
  for (const keyType of ["eval", "main"] as const) {
    const usage = geminiAll[keyType];
    console.log(`    ${keyLabels[keyType]}`);
    console.log(`    RPD: ${bar(usage.requests, usage.rpd)}`);
    if (usage.lastUpdated) {
      const lastJST = new Date(
        new Date(usage.lastUpdated).getTime() + 9 * 60 * 60 * 1000,
      );
      console.log(
        `    Last: ${lastJST.toISOString().replace("T", " ").slice(0, 19)} JST`,
      );
    }
  }
  console.log(`  Reset: ${geminiResetJST} (${hoursUntilReset.toFixed(1)}h)`);

  // ─── OpenAI ───
  // biome-ignore lint/suspicious/noExplicitAny: .dev.vars の型
  const { env, dispose } = await getPlatformProxy<any>({
    configPath: "wrangler.jsonc",
  });
  const openaiKey = env.OPENAI_API_KEY as string | undefined;

  if (openaiKey) {
    section("OpenAI (gpt-4.1-nano) — Eval スコアラー用");
    const oai = await fetchOpenAIQuota(openaiKey);
    if (oai) {
      const usedReq = oai.limitRequests - oai.remainingRequests;
      const usedTok = oai.limitTokens - oai.remainingTokens;
      console.log(`    RPM: ${bar(usedReq, oai.limitRequests)}`);
      console.log(`    TPM: ${bar(usedTok, oai.limitTokens)}`);
      console.log(`    Reset: RPM ${oai.resetRequests}, TPM ${oai.resetTokens}`);
    } else {
      console.log("    ⚠️  取得失敗");
    }
  } else {
    section("OpenAI: OPENAI_API_KEY 未設定");
  }

  // ─── Vectorize ───
  section("Vectorize");
  for (const envName of ["local", "dev", "prd"] as const) {
    const info = fetchVectorizeInfo(envName);
    if (info) {
      const dateStr =
        info.processedUpToDatetime !== "unknown"
          ? new Date(
              new Date(info.processedUpToDatetime).getTime() +
                9 * 60 * 60 * 1000,
            )
              .toISOString()
              .slice(0, 16)
              .replace("T", " ")
          : "unknown";
      console.log(
        `    ${envName.padEnd(5)}: ${info.vectorCount.toLocaleString().padStart(6)} vectors  (${dateStr} JST)`,
      );
    }
  }

  console.log("");

  await dispose();
};

main().catch(console.error);
