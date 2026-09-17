import {
  normalizeSentiment,
  normalizeTopic,
  personaAttributes,
} from "@nepp-chan/shared/lib/persona-attributes";
import { personaRepository } from "~/repository/persona-repository";
import { personaTagGroupRepository } from "~/repository/persona-tag-group-repository";
import { personaEntitiesSchema } from "~/schemas/persona-entity-schema";
import { emptySentimentCounts } from "./aggregate";

export type TagGroupKind = "attribute" | "topic" | "exclude";

export type TagGroup = {
  id: string;
  name: string;
  kind: TagGroupKind;
  axis: string | null;
  sortOrder: number;
};

export type AliasMap = Map<string, string | null>;

type AudienceRow = {
  tags: string | null;
  demographicSummary: string | null;
  topic: string | null;
  sentiment: string | null;
  entities: string | null;
  content: string;
  conversationEndedAt: string | null;
};

const SAMPLE_LIMIT = 2;
const ENTITY_LIMIT = 8;
const TAG_LIMIT = 8;
const SAMPLE_PRIORITY: Record<string, number> = { negative: 0, request: 0 };

export const normalizeTag = (tag: string) => tag.normalize("NFKC").trim();

export const splitAttributes = (attributes: string) => [
  ...new Set(
    attributes
      .split(/[,、]/)
      .map(normalizeTag)
      .filter((tag) => tag.length > 0),
  ),
];

export const resolveGroups = (
  attributes: string,
  aliases: AliasMap,
  groups: TagGroup[],
) => {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const resolved = new Map<string, TagGroup>();
  for (const tag of splitAttributes(attributes)) {
    const groupId = aliases.get(tag);
    const group = groupId ? byId.get(groupId) : undefined;
    if (group && group.kind !== "exclude") resolved.set(group.id, group);
  }
  return [...resolved.values()];
};

export const partitionByPriority = (resolved: TagGroup[], axis: string) =>
  resolved
    .filter((g) => g.axis === axis)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;

const parseEntityNames = (raw: string | null) => {
  if (!raw) return [];
  try {
    const parsed = personaEntitiesSchema.safeParse(JSON.parse(raw));
    return parsed.success
      ? parsed.data
          .map((e) => e.name.normalize("NFKC").trim())
          .filter((name) => name.length > 0)
      : [];
  } catch {
    return [];
  }
};

const increment = <K>(map: Map<K, number>, key: K) =>
  map.set(key, (map.get(key) ?? 0) + 1);

const topCounts = (map: Map<string, number>, limit: number) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .slice(0, limit);

type Sample = {
  content: string;
  topic: string;
  sentiment: string;
  endedAt: string;
};

const pickSamples = (samples: Sample[]) =>
  [...samples]
    .sort(
      (a, b) =>
        (SAMPLE_PRIORITY[a.sentiment] ?? 1) -
          (SAMPLE_PRIORITY[b.sentiment] ?? 1) ||
        b.endedAt.localeCompare(a.endedAt),
    )
    .slice(0, SAMPLE_LIMIT)
    .map(({ content, topic, sentiment }) => ({ content, topic, sentiment }));

type GroupAgg = {
  group: TagGroup;
  count: number;
  topics: Map<string, ReturnType<typeof emptySentimentCounts>>;
  entities: Map<string, number>;
  tags: Map<string, number>;
  samples: Sample[];
};

export const aggregateAudiences = (
  rows: AudienceRow[],
  groups: TagGroup[],
  aliases: AliasMap,
) => {
  const aggs = new Map<string, GroupAgg>();
  const byId = new Map(groups.map((g) => [g.id, g]));

  for (const row of rows) {
    const tags = splitAttributes(personaAttributes(row));
    const topic = normalizeTopic(row.topic);
    const sentiment = normalizeSentiment(row.sentiment);
    const entityNames = parseEntityNames(row.entities);

    const resolved = new Map<string, TagGroup>();
    for (const tag of tags) {
      const groupId = aliases.get(tag);
      const group = groupId ? byId.get(groupId) : undefined;
      if (group) resolved.set(group.id, group);
    }
    const topicGroupNames = [...resolved.values()]
      .filter((g) => g.kind === "topic")
      .map((g) => g.name);

    for (const group of resolved.values()) {
      if (group.kind !== "attribute") continue;
      const agg: GroupAgg = aggs.get(group.id) ?? {
        group,
        count: 0,
        topics: new Map(),
        entities: new Map(),
        tags: new Map(),
        samples: [],
      };
      agg.count += 1;
      const counts = agg.topics.get(topic) ?? emptySentimentCounts();
      counts[sentiment] += 1;
      agg.topics.set(topic, counts);
      for (const name of entityNames) increment(agg.entities, name);
      for (const name of topicGroupNames) increment(agg.tags, name);
      agg.samples.push({
        content: row.content,
        topic,
        sentiment,
        endedAt: row.conversationEndedAt ?? "",
      });
      aggs.set(group.id, agg);
    }
  }

  const axisOrder = new Map<string, number>();
  for (const g of groups) {
    if (g.kind !== "attribute" || !g.axis) continue;
    axisOrder.set(
      g.axis,
      Math.min(axisOrder.get(g.axis) ?? g.sortOrder, g.sortOrder),
    );
  }

  const axes = [...axisOrder.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([axis]) => ({
      axis,
      groups: [...aggs.values()]
        .filter((agg) => agg.group.axis === axis)
        .sort((a, b) => a.group.sortOrder - b.group.sortOrder)
        .map((agg) => ({
          id: agg.group.id,
          name: agg.group.name,
          count: agg.count,
          topics: [...agg.topics.entries()]
            .sort((a, b) => sum(b[1]) - sum(a[1]))
            .map(([t, c]) => ({ topic: t, ...c })),
          entities: topCounts(agg.entities, ENTITY_LIMIT).map(
            ([name, count]) => ({
              name,
              count,
            }),
          ),
          tags: topCounts(agg.tags, TAG_LIMIT).map(([tag, count]) => ({
            tag,
            count,
          })),
          samples: pickSamples(agg.samples),
        })),
    }))
    .filter((axis) => axis.groups.length > 0);

  return { axes };
};

const sum = (c: ReturnType<typeof emptySentimentCounts>) =>
  c.positive + c.negative + c.request + c.neutral;

export const RELATION_AXIS = "関わり";

export const collectUnassignedTags = (
  rows: Pick<AudienceRow, "tags" | "demographicSummary">[],
  aliases: AliasMap,
) => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of splitAttributes(personaAttributes(row))) {
      if (!aliases.get(tag)) increment(counts, tag);
    }
  }
  return topCounts(counts, Number.POSITIVE_INFINITY).map(([tag, count]) => ({
    tag,
    count,
  }));
};

export const collectUnmappedTags = (
  rows: Pick<AudienceRow, "tags" | "demographicSummary">[],
  aliases: AliasMap,
) => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of splitAttributes(personaAttributes(row))) {
      if (!aliases.has(tag)) increment(counts, tag);
    }
  }
  return topCounts(counts, Number.POSITIVE_INFINITY).map(([tag, count]) => ({
    tag,
    count,
  }));
};

export const sanitizeAssignments = (
  assignments: { tag: string; groupId: string | null }[],
  batchTags: string[],
  groups: TagGroup[],
) => {
  const groupIds = new Set(groups.map((g) => g.id));
  const decided = new Map(
    assignments
      .filter((a) => batchTags.includes(a.tag))
      .map(
        (a) =>
          [
            a.tag,
            a.groupId && groupIds.has(a.groupId) ? a.groupId : null,
          ] as const,
      ),
  );
  return batchTags.map((tag) => ({ tag, groupId: decided.get(tag) ?? null }));
};

export const loadTagGroups = async (d1: D1Database) => {
  const [groupRows, aliasRows] = await Promise.all([
    personaTagGroupRepository.listGroups(d1),
    personaTagGroupRepository.listAliases(d1),
  ]);
  const groups: TagGroup[] = groupRows.map((g) => ({
    id: g.id,
    name: g.name,
    kind: g.kind as TagGroupKind,
    axis: g.axis,
    sortOrder: g.sortOrder,
  }));
  const aliases: AliasMap = new Map(aliasRows.map((a) => [a.tag, a.groupId]));
  return { groups, aliases };
};

export const getAudiences = async (
  d1: D1Database,
  period: { from?: string; to?: string },
) => {
  const [{ groups, aliases }, rows] = await Promise.all([
    loadTagGroups(d1),
    personaRepository.listForAudience(d1, period),
  ]);
  return aggregateAudiences(rows, groups, aliases);
};
