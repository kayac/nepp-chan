import { logger } from "~/lib/logger";
import { extractAllPendingThreads } from "~/services/persona-extractor";

export const handlePersonaExtract: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (_event, env, _ctx) => {
  logger.info(`[PersonaExtract] Cron triggered at ${new Date().toISOString()}`);

  try {
    const results = await extractAllPendingThreads(env);

    const extracted = results.filter(
      (r) => "extracted" in r.result && r.result.extracted,
    ).length;
    const skipped = results.filter(
      (r) => "skipped" in r.result && r.result.skipped,
    ).length;

    logger.info(
      `[PersonaExtract] Completed: ${extracted} extracted, ${skipped} skipped`,
    );
  } catch (error) {
    logger.error("[PersonaExtract] Error", error);
    // withSentry が未捕捉例外として自動送信するため再 throw のみ
    throw error;
  }
};
