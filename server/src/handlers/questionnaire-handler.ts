import { logger } from "~/lib/logger";
import { questionnaireRepository } from "~/repository/questionnaire-repository";
import { sendQuestionnaire } from "~/services/questionnaire-delivery";

export const handleQuestionnaireCheck: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (_event, env, _ctx) => {
  const ready = await questionnaireRepository.findScheduledReady(env.DB);

  if (ready.length === 0) {
    return;
  }

  logger.info(
    `[Questionnaire] Found ${ready.length} scheduled questionnaire(s) to send`,
  );

  for (const questionnaire of ready) {
    const result = await sendQuestionnaire(env, questionnaire.id);
    if (result.success) {
      logger.info(
        `[Questionnaire] Sent: ${questionnaire.id} "${questionnaire.title}"`,
      );
    } else {
      logger.error(
        `[Questionnaire] Failed: ${questionnaire.id} "${questionnaire.title}" - ${result.error}`,
      );
    }
  }
};
