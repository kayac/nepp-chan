import { handleBroadcastCheck } from "~/handlers/broadcast-handler";
import { handlePersonaExtract } from "~/handlers/persona-extract-handler";

export const handleScheduled: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (event, env, ctx) => {
  switch (event.cron) {
    case "*/5 * * * *":
      return handleBroadcastCheck(event, env, ctx);
    case "0 18 * * *":
      return handlePersonaExtract(event, env, ctx);
  }
};
