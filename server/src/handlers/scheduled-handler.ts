import { handleBroadcastCheck } from "~/handlers/broadcast-handler";
import { handleDataRetention } from "~/handlers/data-retention-handler";
import { handlePersonaExtract } from "~/handlers/persona-extract-handler";
import { handlePollCheck } from "~/handlers/poll-handler";

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
  }
};
