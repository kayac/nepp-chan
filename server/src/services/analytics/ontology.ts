import {
  normalizeSentiment,
  normalizeTopic,
  personaAttributes,
} from "@nepp-chan/shared/lib/persona-attributes";
import { personaRepository } from "~/repository/persona-repository";
import { personaEntitiesSchema } from "~/schemas/persona-entity-schema";
import { emptySentimentCounts } from "./aggregate";

const SEGMENTS = [
  "観光客",
  "移住検討者",
  "帰省者",
  "村内住民",
  "村外",
  "不明セグメント",
] as const;
export type Segment = (typeof SEGMENTS)[number];

const ROLES = [
  "接続点",
  "争点",
  "不満点",
  "満足点",
  "関心点",
  "セグメント",
] as const;
export type OntologyRole = (typeof ROLES)[number];

export interface OntologyNode {
  id: string;
  label: string;
  kind: "segment" | "topic" | "entity";
  type?: string;
  topic?: string;
  count: number;
  role: OntologyRole;
  roles: OntologyRole[];
  bySegment?: Record<string, number>;
  bySentiment?: Record<string, number>;
}

export interface OntologyLink {
  source: string;
  target: string;
  n: number;
  kind: "seg-topic" | "topic-ent" | "seg-ent";
}

export interface OntologyData {
  nodes: OntologyNode[];
  links: OntologyLink[];
  meta: {
    personaTotal: number;
    generatedAt: string;
    entityLayerStatus: "none" | "ready" | "stale";
    note: string;
  };
}

type SentimentCounts = ReturnType<typeof emptySentimentCounts>;

const MIN_ENTITY_COUNT = 3;
const MAX_SEGMENT_LINKS = 3;
const DISPUTE_SHARE = 0.08;
const BIAS_SHARE = 0.12;
const SEGMENT_SHARE = 0.15;

export const extractSegment = (attributes: string): Segment => {
  if (attributes.includes("観光客")) return "観光客";
  if (attributes.includes("移住検討者")) return "移住検討者";
  if (attributes.includes("帰省者")) return "帰省者";
  if (attributes.includes("村人")) return "村内住民";
  if (attributes.includes("村外")) return "村外";
  if (attributes.includes("村内")) return "村内住民";
  return "不明セグメント";
};

export const classifyRoles = (
  bySentiment: SentimentCounts,
  bySegment: Map<Segment, number>,
): OntologyRole[] => {
  const sentimentTotal =
    bySentiment.positive +
    bySentiment.negative +
    bySentiment.request +
    bySentiment.neutral;
  const pos = sentimentTotal ? bySentiment.positive / sentimentTotal : 0;
  const neg = sentimentTotal ? bySentiment.negative / sentimentTotal : 0;

  const knownSegmentTotal = [...bySegment.entries()]
    .filter(([segment]) => segment !== "不明セグメント")
    .reduce((sum, [, count]) => sum + count, 0);
  const diversity = knownSegmentTotal
    ? [...bySegment.entries()].filter(
        ([segment, count]) =>
          segment !== "不明セグメント" &&
          count / knownSegmentTotal >= SEGMENT_SHARE,
      ).length
    : 0;

  const roles: OntologyRole[] = [];
  if (pos >= DISPUTE_SHARE && neg >= DISPUTE_SHARE) roles.push("争点");
  if (neg >= BIAS_SHARE) roles.push("不満点");
  if (pos >= BIAS_SHARE) roles.push("満足点");
  if (diversity >= 2) roles.push("接続点");
  if (roles.length === 0) roles.push("関心点");
  return roles;
};

export const nonZeroRecord = (entries: Iterable<[string, number]>) =>
  Object.fromEntries([...entries].filter(([, count]) => count > 0));

const increment = <K>(map: Map<K, number>, key: K) =>
  map.set(key, (map.get(key) ?? 0) + 1);

const dominantTopic = (topicCounts: Map<string, number>) =>
  [...topicCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "その他";

const topSegments = (bySegment: Map<Segment, number>, n: number) =>
  [...bySegment.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

const roleAndBreakdowns = (
  bySentiment: SentimentCounts,
  bySegment: Map<Segment, number>,
) => {
  const roles = classifyRoles(bySentiment, bySegment);
  return {
    role: roles[0],
    roles,
    bySegment: nonZeroRecord(bySegment),
    bySentiment: nonZeroRecord(Object.entries(bySentiment)),
  };
};

const parseEntities = (raw: string | null) => {
  if (!raw) return [];
  try {
    const parsed = personaEntitiesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

type EntityAgg = {
  canonical: string;
  type: string;
  count: number;
  topicCounts: Map<string, number>;
  bySegment: Map<Segment, number>;
  bySentiment: SentimentCounts;
};

export const getOntology = async (d1: D1Database): Promise<OntologyData> => {
  const rows = await personaRepository.listAllAttributesWithEntities(d1);

  const segmentCounts = new Map<Segment, number>();
  const topicAgg = new Map<
    string,
    {
      total: number;
      bySentiment: SentimentCounts;
      bySegment: Map<Segment, number>;
    }
  >();
  const linkCounts = new Map<string, number>();
  const entityAgg = new Map<string, EntityAgg>();
  let entitiesPending = false;

  for (const row of rows) {
    if (row.entities === null) entitiesPending = true;

    const attributes = personaAttributes(row);
    const segment = extractSegment(attributes);
    const sentiment = normalizeSentiment(row.sentiment);
    const topic = normalizeTopic(row.topic);

    increment(segmentCounts, segment);

    const agg = topicAgg.get(topic) ?? {
      total: 0,
      bySentiment: emptySentimentCounts(),
      bySegment: new Map<Segment, number>(),
    };
    agg.total += 1;
    agg.bySentiment[sentiment] += 1;
    increment(agg.bySegment, segment);
    topicAgg.set(topic, agg);

    increment(linkCounts, `${segment} ${topic}`);

    for (const entity of parseEntities(row.entities)) {
      const canonical = entity.name.normalize("NFKC").trim();
      if (!canonical) continue;

      const ent = entityAgg.get(canonical) ?? {
        canonical,
        type: entity.type,
        count: 0,
        topicCounts: new Map<string, number>(),
        bySegment: new Map<Segment, number>(),
        bySentiment: emptySentimentCounts(),
      };
      ent.count += 1;
      ent.bySentiment[sentiment] += 1;
      increment(ent.topicCounts, topic);
      increment(ent.bySegment, segment);
      entityAgg.set(canonical, ent);
    }
  }

  const segmentNodes: OntologyNode[] = [...segmentCounts.entries()].map(
    ([label, count]) => ({
      id: `seg:${label}`,
      label,
      kind: "segment",
      count,
      role: "セグメント",
      roles: [],
    }),
  );

  const topicNodes: OntologyNode[] = [...topicAgg.entries()].map(
    ([label, agg]) => ({
      id: `top:${label}`,
      label,
      kind: "topic",
      count: agg.total,
      ...roleAndBreakdowns(agg.bySentiment, agg.bySegment),
    }),
  );

  const links: OntologyLink[] = [...linkCounts.entries()].map(([key, n]) => {
    const [segment, topic] = key.split(" ");
    return {
      source: `seg:${segment}`,
      target: `top:${topic}`,
      n,
      kind: "seg-topic",
    };
  });

  const entityNodes: OntologyNode[] = [];
  for (const ent of entityAgg.values()) {
    if (ent.count < MIN_ENTITY_COUNT) continue;

    const topic = dominantTopic(ent.topicCounts);
    const id = `ent:${ent.canonical}`;
    entityNodes.push({
      id,
      label: ent.canonical,
      kind: "entity",
      type: ent.type,
      topic,
      count: ent.count,
      ...roleAndBreakdowns(ent.bySentiment, ent.bySegment),
    });
    links.push({
      source: id,
      target: `top:${topic}`,
      n: ent.count,
      kind: "topic-ent",
    });
    for (const [segment, n] of topSegments(ent.bySegment, MAX_SEGMENT_LINKS)) {
      links.push({ source: `seg:${segment}`, target: id, n, kind: "seg-ent" });
    }
  }

  return {
    nodes: [...segmentNodes, ...topicNodes, ...entityNodes],
    links,
    meta: {
      personaTotal: rows.length,
      generatedAt: new Date().toISOString(),
      entityLayerStatus:
        entityNodes.length === 0 ? "none" : entitiesPending ? "stale" : "ready",
      note: "persona の全数集計。具体エンティティは LLM 抽出",
    },
  };
};
