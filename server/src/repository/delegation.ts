import { type Column, sql } from "drizzle-orm";

// Mastra の委譲先スレッドは id・resourceId とも「委譲元の値-」で始まる
export const isDelegatedFrom = (column: Column, parent: Column | string) =>
  sql`substr(${column}, 1, length(${parent}) + 1) = ${parent} || '-'`;

export const isSelfOrDelegatedFrom = (column: Column, id: string) =>
  sql`(${column} = ${id} OR ${isDelegatedFrom(column, id)})`;
