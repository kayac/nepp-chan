import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { getStorage } from "~/lib/storage";
import { tagGroupAgent } from "~/mastra/agents/tag-group-agent";
import { createRequestContext } from "~/mastra/request-context";
import { personaRepository } from "~/repository/persona-repository";
import { personaTagGroupRepository } from "~/repository/persona-tag-group-repository";
import {
  type ChoiceQuestion,
  createDecider,
  type Decider,
} from "~/services/decision/decider";
import {
  collectTagExamples,
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

type Assignment = { tag: string; groupId: string | null };

const DECIDE_CONCURRENCY = 8;

const NO_GROUP = "none";

const KIND_LABELS: Record<TagGroup["kind"], string> = {
  attribute: "話者自身の属性",
  topic: "話題",
  exclude: "集計に使えない語（分類名の写し・地名・意味の無い語）",
};

const examplesOf = (groupId: string, aliases: Map<string, string | null>) =>
  [...aliases.entries()]
    .filter(([, id]) => id === groupId)
    .slice(0, EXAMPLE_LIMIT)
    .map(([tag]) => tag);

const tagGroupQuestion = (
  groups: TagGroup[],
  aliases: Map<string, string | null>,
): ChoiceQuestion => ({
  type: "choice",
  instructions:
    "村の声（ペルソナ）に付いた自由記述のタグを、最も意味の合うグループに振り分ける。属性のグループは話者自身の属性、話題のグループは話題。合うものが無い、または迷うなら none。",
  criteria: {
    ...Object.fromEntries(
      groups.map((g) => {
        const axis = g.axis ? `・${g.axis}` : "";
        const examples = examplesOf(g.id, aliases).join("、");
        return [
          g.id,
          `${g.name}（${KIND_LABELS[g.kind]}${axis}）${examples ? `。例: ${examples}` : ""}`,
        ];
      }),
    ),
    [NO_GROUP]: "意味が一致するグループが無い、または判断に迷う",
  },
});

const classifyWithDecider = async (
  tags: string[],
  question: ChoiceQuestion,
  decider: Decider,
) => {
  const assignments: Assignment[] = [];
  const queue = [...tags];
  await Promise.all(
    Array.from({ length: DECIDE_CONCURRENCY }, async () => {
      for (let tag = queue.shift(); tag !== undefined; tag = queue.shift()) {
        try {
          const { group } = await decider.decide(tag, { group: question });
          assignments.push({
            tag,
            groupId: group.choice === NO_GROUP ? null : group.choice,
          });
        } catch (error) {
          logger.warn("[TagGroup] jev failed, retry next run", {
            tag,
            error: String(error),
          });
        }
      }
    }),
  );
  return assignments;
};

const describeGroups = (
  groups: TagGroup[],
  aliases: Map<string, string | null>,
) =>
  groups
    .map((g) => {
      const examples = examplesOf(g.id, aliases).join(", ");
      const axis = g.axis ? ` / ${g.axis}` : "";
      return `- ${g.id}: ${g.name}（${g.kind}${axis}）例: ${examples || "なし"}`;
    })
    .join("\n");

const classifyWithAgent = async (
  classifier: Classifier,
  batch: { tag: string; count: number }[],
  groups: TagGroup[],
  aliases: Map<string, string | null>,
  requestContext: RequestContext,
) => {
  const result = await classifier.generate(
    `## グループ一覧\n${describeGroups(groups, aliases)}\n\n## 振り分けるタグ（件数）\n${batch
      .map((t) => `- ${t.tag}（${t.count}）`)
      .join("\n")}`,
    { requestContext, structuredOutput: { schema: assignmentSchema } },
  );
  const assignments: Assignment[] = result.object?.assignments ?? [];
  return assignments;
};

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
  const decider = createDecider(requestContext, {
    source: "tag-group-assign",
    agent: "tag-group",
  });
  const batchTags = batch.map((t) => t.tag);
  const decided = decider
    ? await classifyWithDecider(
        batchTags,
        tagGroupQuestion(groups, aliases),
        decider,
      )
    : await classifyWithAgent(
        options.classifier ?? tagGroupAgent,
        batch,
        groups,
        aliases,
        requestContext,
      );
  const settledTags = decider ? decided.map((a) => a.tag) : batchTags;

  const decisions = sanitizeAssignments(decided, settledTags, groups);
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
const RECENT_LIMIT = 20;

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
  const examples = collectTagExamples(rows);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  return {
    groups: groups.map((g) => ({
      ...g,
      tags: (tagsByGroup.get(g.id) ?? [])
        .map((t) => ({ ...t, count: counts.get(t.tag) ?? 0 }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ja")),
    })),
    unassigned: collectUnassignedTags(counts, aliases).map((u) => ({
      ...u,
      example: examples.get(u.tag) ?? null,
    })),
    recent: aliasRows
      .flatMap((a) =>
        a.assignedBy === "llm" && a.groupId
          ? [
              {
                tag: a.tag,
                groupId: a.groupId,
                groupName: groupName.get(a.groupId) ?? a.groupId,
                assignedAt: a.createdAt,
              },
            ]
          : [],
      )
      .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
      .slice(0, RECENT_LIMIT),
  };
};
