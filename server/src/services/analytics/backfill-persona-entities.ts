import { z } from "zod";
import { GEMINI_FLASH } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { ontologyEntityAgent } from "~/mastra/agents/ontology-entity-agent";
import { personaRepository } from "~/repository/persona-repository";
import { personaEntitiesSchema } from "~/schemas/persona-entity-schema";
import { recordLlmUsage } from "./llm-usage";

const BACKFILL_LIMIT = 30;

const extractionSchema = z.object({ entities: personaEntitiesSchema });

// entities 未取得の既存 persona を 1 件ずつ LLM 抽出して埋める（冪等・再開可能）。
// 1 呼び出しで最大 BACKFILL_LIMIT 件処理し、残数を返す。
export const backfillPersonaEntities = async (env: CloudflareBindings) => {
  const targets = await personaRepository.listMissingEntities(
    env.DB,
    BACKFILL_LIMIT,
  );

  let updated = 0;
  for (const target of targets) {
    const result = await ontologyEntityAgent.generate(target.content, {
      structuredOutput: { schema: extractionSchema },
    });
    await recordLlmUsage(env.DB, {
      model: GEMINI_FLASH,
      usage: result.totalUsage,
      source: "ontology",
    });

    const entities = result.object?.entities ?? [];
    await personaRepository.update(env.DB, target.id, {
      entities: JSON.stringify(entities),
    });
    if (entities.length > 0) updated += 1;
  }

  const remaining = await personaRepository.countMissingEntities(env.DB);
  if (targets.length > 0) {
    logger.info(
      `[Ontology] backfilled ${targets.length} personas, ${remaining} remaining`,
    );
  }

  return { processed: targets.length, updated, remaining };
};
