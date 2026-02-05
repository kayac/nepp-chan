#!/usr/bin/env tsx
/**
 * 評価ワークフロー実行用CLIスクリプト
 *
 * 使用方法:
 *   pnpm eval:run
 *
 * 機能:
 *   - evalBatchWorkflow を実行し、RAG評価結果をJSON形式で出力
 *   - getPlatformProxy で Cloudflare リソース (D1, Vectorize, R2) にアクセス
 */

import { Mastra } from "@mastra/core/mastra";
import { RequestContext } from "@mastra/core/request-context";
import { LibSQLStore } from "@mastra/libsql";
import { PinoLogger } from "@mastra/loggers";
import { getPlatformProxy } from "wrangler";

import { knowledgeAgent } from "../src/mastra/agents/knowledge-agent";
import { evalBatchWorkflow } from "../src/mastra/workflows/eval-workflow";

const main = async () => {
  console.log("🔄 評価ワークフローを開始します...\n");

  // Cloudflare バインディングを取得
  const { env } = await getPlatformProxy<CloudflareBindings>({
    configPath: "wrangler.jsonc",
  });

  // Mastra インスタンスを作成
  const mastra = new Mastra({
    workflows: { evalBatchWorkflow },
    agents: { knowledgeAgent },
    storage: new LibSQLStore({
      id: "mastra-storage",
      url: "file:mastra.db",
    }),
    logger: new PinoLogger({
      name: "Mastra",
      level: "warn",
    }),
  });

  // RequestContext を作成し、env を設定
  const requestContext = new RequestContext();
  requestContext.set("env", env);

  // ワークフローを実行
  const workflow = mastra.getWorkflow("evalBatchWorkflow");
  const run = await workflow.createRun();
  const result = await run.start({
    inputData: {},
    requestContext,
  });

  if (result.status === "success") {
    console.log("\n✅ 評価完了\n");
    console.log(JSON.stringify(result.result, null, 2));
  } else {
    console.error("\n❌ 評価失敗");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("❌ エラーが発生しました:", error);
  process.exit(1);
});
