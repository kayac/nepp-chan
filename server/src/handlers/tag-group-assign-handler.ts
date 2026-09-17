import { logger } from "~/lib/logger";
import { assignUnmappedTags } from "~/services/analytics/tag-group-assign";

export const handleTagGroupAssign: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (_event, env, _ctx) => {
  try {
    const result = await assignUnmappedTags(env);
    logger.info(
      `[TagGroupAssign] assigned=${result.assigned} unassigned=${result.unassigned} remaining=${result.remaining}`,
    );
  } catch (error) {
    logger.error("[TagGroupAssign] Error", error);
  }
};
