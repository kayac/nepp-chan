import { isNotNull } from "drizzle-orm";
import { z } from "zod";
import { createDb, persona } from "~/db";
import { GEMINI_FLASH } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { ontologyEntityAgent } from "~/mastra/agents/ontology-entity-agent";
import { ontologySnapshotRepository } from "~/repository/ontology-snapshot-repository";
import { emptySentimentCounts, normalizeSentiment, TOPICS } from "./aggregate";
import { recordLlmUsage } from "./llm-usage";
import {
  classifyRoles,
  extractSegment,
  nonZeroRecord,
  type OntologyLink,
  type OntologyNode,
  type Segment,
} from "./ontology";

const BATCH_SIZE = 40;
const MAX_PERSONAS = 2000;
const MIN_ENTITY_COUNT = 3;
const MAX_SEGMENT_LINKS = 3;

const ENTITY_TYPES = [
  "place",
  "facility",
  "service",
  "institution",
  "event",
  "org",
] as const;

const extractionSchema = z.object({
  voices: z.array(
    z.object({
      index: z.number(),
      entities: z.array(
        z.object({ name: z.string(), type: z.enum(ENTITY_TYPES) }),
      ),
    }),
  ),
});

type SentimentCounts = ReturnType<typeof emptySentimentCounts>;

type EntityAgg = {
  canonical: string;
  type: string;
  count: number;
  aliases: Set<string>;
  topicCounts: Map<string, number>;
  bySegment: Map<Segment, number>;
  bySentiment: SentimentCounts;
};

const normalizeName = (name: string) => name.normalize("NFKC").trim();

const increment = <K>(map: Map<K, number>, key: K) =>
  map.set(key, (map.get(key) ?? 0) + 1);

const dominantTopic = (topicCounts: Map<string, number>) =>
  [...topicCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "その他";

const topSegments = (bySegment: Map<Segment, number>, n: number) =>
  [...bySegment.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

export const runOntologyEntities = async (
  env: CloudflareBindings,
  params: { generatedBy: string },
) => {
  const db = createDb(env.DB);

  const rows = await db
    .select({
      content: persona.content,
      topic: persona.topic,
      sentiment: persona.sentiment,
      tags: persona.tags,
      demographicSummary: persona.demographicSummary,
    })
    .from(persona)
    .where(isNotNull(persona.content))
    .limit(MAX_PERSONAS)
    .all();

  const voices = rows.map((row, index) => ({
    index,
    content: row.content,
    segment: extractSegment(
      [row.tags, row.demographicSummary].filter(Boolean).join(","),
    ),
    sentiment: normalizeSentiment(row.sentiment),
    topic: TOPICS.includes(row.topic as (typeof TOPICS)[number])
      ? (row.topic as string)
      : "その他",
  }));
  const voiceByIndex = new Map(voices.map((v) => [v.index, v]));

  const entities = new Map<string, EntityAgg>();

  for (let i = 0; i < voices.length; i += BATCH_SIZE) {
    const batch = voices.slice(i, i + BATCH_SIZE);
    const prompt = batch.map((v) => `[${v.index}] ${v.content}`).join("\n");

    const result = await ontologyEntityAgent.generate(prompt, {
      structuredOutput: { schema: extractionSchema },
    });
    await recordLlmUsage(env.DB, {
      model: GEMINI_FLASH,
      usage: result.totalUsage,
      source: "ontology",
    });

    for (const voiceOut of result.object?.voices ?? []) {
      const voice = voiceByIndex.get(voiceOut.index);
      if (!voice) continue;

      for (const entity of voiceOut.entities) {
        const canonical = normalizeName(entity.name);
        if (!canonical) continue;

        const agg = entities.get(canonical) ?? {
          canonical,
          type: entity.type,
          count: 0,
          aliases: new Set<string>(),
          topicCounts: new Map<string, number>(),
          bySegment: new Map<Segment, number>(),
          bySentiment: emptySentimentCounts(),
        };
        agg.count += 1;
        agg.aliases.add(entity.name);
        agg.bySentiment[voice.sentiment] += 1;
        increment(agg.topicCounts, voice.topic);
        increment(agg.bySegment, voice.segment);
        entities.set(canonical, agg);
      }
    }
  }

  const nodes: OntologyNode[] = [];
  const links: OntologyLink[] = [];

  for (const agg of entities.values()) {
    if (agg.count < MIN_ENTITY_COUNT) continue;

    const topic = dominantTopic(agg.topicCounts);
    const roles = classifyRoles(agg.bySentiment, agg.bySegment);
    const id = `ent:${agg.canonical}`;
    nodes.push({
      id,
      label: agg.canonical,
      kind: "entity",
      type: agg.type,
      topic,
      count: agg.count,
      role: roles[0],
      roles,
      bySegment: nonZeroRecord(agg.bySegment),
      bySentiment: nonZeroRecord(Object.entries(agg.bySentiment)),
    });

    links.push({
      source: id,
      target: `top:${topic}`,
      n: agg.count,
      kind: "topic-ent",
    });
    for (const [segment, n] of topSegments(agg.bySegment, MAX_SEGMENT_LINKS)) {
      links.push({ source: `seg:${segment}`, target: id, n, kind: "seg-ent" });
    }
  }

  await ontologySnapshotRepository.upsert(env.DB, {
    id: "latest",
    dataJson: JSON.stringify({ entities: nodes, links }),
    entityCount: nodes.length,
    generatedAt: new Date().toISOString(),
    generatedBy: params.generatedBy,
  });

  if (rows.length >= MAX_PERSONAS) {
    logger.info(
      `[Ontology] persona を ${MAX_PERSONAS} 件で打ち切りました（全件ではありません）`,
    );
  }

  return { entityCount: nodes.length, personaProcessed: rows.length };
};
