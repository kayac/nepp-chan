import { logger } from "~/lib/logger";
import { markPrivacyCriticalScope } from "~/lib/sentry-helpers";
import { runDataRetention } from "~/services/data-retention";

export const handleDataRetention: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (_event, env, _ctx) => {
  logger.info(`[DataRetention] Cron triggered at ${new Date().toISOString()}`);

  try {
    const results = await runDataRetention(env);
    const total = results.reduce((sum, r) => sum + r.deletedCount, 0);

    logger.info(
      `[DataRetention] Completed: ${total} total rows deleted across ${results.length} tables`,
    );
  } catch (error) {
    markPrivacyCriticalScope("data-retention-handler");
    logger.error("[DataRetention] Error", error);
    throw error;
  }
};
