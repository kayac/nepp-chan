import { extractAllPendingThreads } from "~/services/persona-extractor";

export const handlePersonaExtract: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (_event, env, _ctx) => {
  console.log(`[PersonaExtract] Cron triggered at ${new Date().toISOString()}`);

  try {
    const results = await extractAllPendingThreads(env);

    const extracted = results.filter(
      (r) => "extracted" in r.result && r.result.extracted,
    ).length;
    const skipped = results.filter(
      (r) => "skipped" in r.result && r.result.skipped,
    ).length;

    console.log(
      `[PersonaExtract] Completed: ${extracted} extracted, ${skipped} skipped`,
    );
  } catch (error) {
    console.error("[PersonaExtract] Error:", error);
    throw error;
  }
};
