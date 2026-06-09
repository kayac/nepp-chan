import { logger } from "~/lib/logger";
import { pollRepository } from "~/repository/poll-repository";
import { sendPoll } from "~/services/poll-delivery";

export const handlePollCheck: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (_event, env, _ctx) => {
  const ready = await pollRepository.findScheduledReady(env.DB);

  if (ready.length === 0) {
    return;
  }

  logger.info(`[Poll] Found ${ready.length} scheduled poll(s) to send`);

  const results = await Promise.allSettled(
    ready.map((poll) => sendPoll(env, poll.id)),
  );

  results.forEach((outcome, i) => {
    const poll = ready[i];
    if (outcome.status === "rejected") {
      logger.error(`[Poll] Failed: ${poll.id} "${poll.title}"`, outcome.reason);
      return;
    }
    if (outcome.value.success) {
      logger.info(`[Poll] Sent: ${poll.id} "${poll.title}"`);
    } else {
      logger.error(
        `[Poll] Failed: ${poll.id} "${poll.title}" - ${outcome.value.error}`,
      );
    }
  });
};
