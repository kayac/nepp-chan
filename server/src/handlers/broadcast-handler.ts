import { logger } from "~/lib/logger";
import { broadcastRepository } from "~/repository/broadcast-repository";
import { sendBroadcast } from "~/services/broadcast-sender";

export const handleBroadcastCheck: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (_event, env, _ctx) => {
  const ready = await broadcastRepository.findScheduledReady(env.DB);

  if (ready.length === 0) {
    return;
  }

  logger.info(`[Broadcast] Found ${ready.length} scheduled message(s) to send`);

  for (const message of ready) {
    const result = await sendBroadcast(env, message.id);
    if (result.success) {
      logger.info(`[Broadcast] Sent: ${message.id} "${message.title}"`);
    } else {
      logger.error(
        `[Broadcast] Failed: ${message.id} "${message.title}" - ${result.error}`,
      );
    }
  }
};
