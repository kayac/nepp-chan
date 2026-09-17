import { z } from "zod";
import { getStorage } from "~/lib/storage";
import { tagGroupAgent } from "~/mastra/agents/tag-group-agent";
import { createRequestContext } from "~/mastra/request-context";
import { personaRepository } from "~/repository/persona-repository";
import { personaTagGroupRepository } from "~/repository/persona-tag-group-repository";
import {
  collectUnassignedTags,
  collectUnmappedTags,
  countTags,
  loadTagGroups,
  sanitizeAssignments,
  type TagGroup,
} from "./tag-groups";

export const ASSIGN_BATCH_SIZE = 100;
const EXAMPLE_LIMIT = 5;

const assignmentSchema = z.object({
  assignments: z.array(
    z.object({ tag: z.string(), groupId: z.string().nullable() }),
  ),
});

type Classifier = Pick<typeof tagGroupAgent, "generate">;

const describeGroups = (
  groups: TagGroup[],
  aliases: Map<string, string | null>,
) =>
  groups
    .map((g) => {
      const examples = [...aliases.entries()]
        .filter(([, groupId]) => groupId === g.id)
        .slice(0, EXAMPLE_LIMIT)
        .map(([tag]) => tag)
        .join(", ");
      const axis = g.axis ? ` / ${g.axis}` : "";
      return `- ${g.id}: ${g.name}（${g.kind}${axis}）例: ${examples || "なし"}`;
    })
    .join("\n");

export const assignUnmappedTags = async (
  env: CloudflareBindings,
  options: { classifier?: Classifier } = {},
) => {
  const [{ groups, aliases }, rows] = await Promise.all([
    loadTagGroups(env.DB),
    personaRepository.listForAudience(env.DB, {}),
  ]);
  const unmapped = collectUnmappedTags(countTags(rows), aliases);
  const batch = unmapped.slice(0, ASSIGN_BATCH_SIZE);
  if (batch.length === 0) {
    return { assigned: 0, unassigned: 0, remaining: 0 };
  }

  const storage = await getStorage(env.DB);
  const requestContext = createRequestContext({ storage, db: env.DB, env });
  const classifier = options.classifier ?? tagGroupAgent;
  const result = await classifier.generate(
    `## グループ一覧\n${describeGroups(groups, aliases)}\n\n## 振り分けるタグ（件数）\n${batch
      .map((t) => `- ${t.tag}（${t.count}）`)
      .join("\n")}`,
    { requestContext, structuredOutput: { schema: assignmentSchema } },
  );

  const decisions = sanitizeAssignments(
    result.object?.assignments ?? [],
    batch.map((t) => t.tag),
    groups,
  );
  await personaTagGroupRepository.insertAliasesIfAbsent(
    env.DB,
    decisions.map((d) => ({ ...d, assignedBy: "llm" as const })),
  );

  return {
    assigned: decisions.filter((d) => d.groupId !== null).length,
    unassigned: decisions.filter((d) => d.groupId === null).length,
    remaining: unmapped.length - batch.length,
  };
};

const SORT_ORDER_STEP = 10;

export const createTagGroup = async (
  d1: D1Database,
  input: { name: string; kind: TagGroup["kind"]; axis?: string | null },
) => {
  const groups = await personaTagGroupRepository.listGroups(d1);
  const maxSortOrder = groups.reduce((max, g) => Math.max(max, g.sortOrder), 0);
  return personaTagGroupRepository.createGroup(d1, {
    id: crypto.randomUUID(),
    name: input.name,
    kind: input.kind,
    axis: input.kind === "attribute" ? (input.axis ?? null) : null,
    sortOrder: maxSortOrder + SORT_ORDER_STEP,
  });
};

export const getTagGroupOverview = async (d1: D1Database) => {
  const [{ groups, aliases, aliasRows }, rows] = await Promise.all([
    loadTagGroups(d1),
    personaRepository.listForAudience(d1, {}),
  ]);
  const tagsByGroup = new Map<string, { tag: string; assignedBy: string }[]>();
  for (const alias of aliasRows) {
    if (!alias.groupId) continue;
    const list = tagsByGroup.get(alias.groupId) ?? [];
    list.push({ tag: alias.tag, assignedBy: alias.assignedBy });
    tagsByGroup.set(alias.groupId, list);
  }
  const counts = countTags(rows);
  return {
    groups: groups.map((g) => ({
      ...g,
      tags: (tagsByGroup.get(g.id) ?? [])
        .map((t) => ({ ...t, count: counts.get(t.tag) ?? 0 }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ja")),
    })),
    unassigned: collectUnassignedTags(counts, aliases),
  };
};
