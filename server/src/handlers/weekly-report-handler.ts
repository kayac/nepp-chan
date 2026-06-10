import * as Sentry from "@sentry/cloudflare";
import { logger } from "~/lib/logger";
import { runWeeklyReport } from "~/services/weekly-report";

export const handleWeeklyReport: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (_event, env, _ctx) => {
  try {
    await Sentry.withMonitor(
      "weekly-report",
      async () => {
        logger.info(
          `[WeeklyReport] Cron triggered at ${new Date().toISOString()}`,
        );

        const { period } = await runWeeklyReport(env);

        logger.info(
          `[WeeklyReport] Completed: ${period.periodStart} - ${period.periodEnd}`,
        );
      },
      {
        schedule: { type: "crontab", value: "0 20 * * 1" },
        timezone: "UTC",
        checkinMargin: 30,
        maxRuntime: 30,
        failureIssueThreshold: 1,
      },
    );
  } catch (error) {
    logger.error("[WeeklyReport] Error", error);
    throw error;
  }
};
