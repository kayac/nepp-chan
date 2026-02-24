import { logger } from "~/lib/logger";
import { extractAllPendingThreads } from "~/services/persona-extractor";

export const handlePersonaExtract: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (_event, env, _ctx) => {
  logger.info("[PersonaExtract] Cron triggered");

  try {
    const results = await extractAllPendingThreads(env);

    const extracted = results.filter(
      (r) => "extracted" in r.result && r.result.extracted,
    ).length;
    const skipped = results.filter(
      (r) => "skipped" in r.result && r.result.skipped,
    ).length;

    logger.info("[PersonaExtract] Completed", { extracted, skipped });
  } catch (error) {
    logger.error("[PersonaExtract] Error", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
