import { handleBroadcastCheck } from "~/handlers/broadcast-handler";
import { handleDataRetention } from "~/handlers/data-retention-handler";
import { handlePersonaExtract } from "~/handlers/persona-extract-handler";
import { handlePollCheck } from "~/handlers/poll-handler";
import { handleWeeklyReport } from "~/handlers/weekly-report-handler";

export const handleScheduled: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (event, env, ctx) => {
  switch (event.cron) {
    case "*/5 * * * *":
      await handleBroadcastCheck(event, env, ctx);
      await handlePollCheck(event, env, ctx);
      return;
    case "0 18 * * *":
      await handlePersonaExtract(event, env, ctx);
      await handleDataRetention(event, env, ctx);
      return;
    // 月曜 20:00 UTC = 火曜 05:00 JST。ペルソナ抽出（03:00 JST）完了後に前週分を集計する
    case "0 20 * * 1":
      await handleWeeklyReport(event, env, ctx);
      return;
  }
};
