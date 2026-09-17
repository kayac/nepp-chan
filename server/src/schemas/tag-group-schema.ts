import { z } from "@hono/zod-openapi";

export const tagGroupKindSchema = z.enum(["attribute", "topic", "exclude"]);

export const tagGroupsResponseSchema = z.object({
  groups: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: tagGroupKindSchema,
      axis: z.string().nullable(),
      sortOrder: z.number(),
      tags: z.array(
        z.object({
          tag: z.string(),
          assignedBy: z.string(),
          count: z.number(),
        }),
      ),
    }),
  ),
  unassigned: z.array(z.object({ tag: z.string(), count: z.number() })),
});

export const setTagAliasBodySchema = z.object({
  groupId: z.string().nullable().describe("null で未分類に戻す"),
});

export const assignTagGroupsResponseSchema = z.object({
  assigned: z.number(),
  unassigned: z.number(),
  remaining: z.number(),
});
