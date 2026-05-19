import * as Sentry from "@sentry/cloudflare";
import { logger } from "~/lib/logger";
import { markPrivacyCriticalScope } from "~/lib/sentry-helpers";
import { runDataRetention } from "~/services/data-retention";

export const handleDataRetention: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (_event, env, _ctx) => {
  try {
    await Sentry.withMonitor(
      "data-retention",
      async () => {
        logger.info(
          `[DataRetention] Cron triggered at ${new Date().toISOString()}`,
        );

        const results = await runDataRetention(env);
        const total = results.reduce((sum, r) => sum + r.deletedCount, 0);

        logger.info(
          `[DataRetention] Completed: ${total} total rows deleted across ${results.length} tables`,
        );
      },
      {
        schedule: { type: "crontab", value: "0 18 * * *" },
        timezone: "UTC",
        // 同 cron で先行する handlePersonaExtract の処理時間を吸収する
        checkinMargin: 30,
        maxRuntime: 30,
        failureIssueThreshold: 1,
      },
    );
  } catch (error) {
    markPrivacyCriticalScope("data-retention-handler");
    logger.error("[DataRetention] Error", error);
    throw error;
  }
};
