import { eq } from "drizzle-orm";
import {
  createDb,
  type NewWidgetSite,
  type WidgetSite,
  widgetSites,
} from "~/db";
import { normalizeSiteHost } from "~/lib/widget-site";

type CreateInput = Omit<NewWidgetSite, "id" | "updatedAt"> & { id: string };

export const widgetSiteRepository = {
  async findByHost(d1: D1Database, host: string) {
    const db = createDb(d1);
    const result = await db
      .select()
      .from(widgetSites)
      .where(eq(widgetSites.host, normalizeSiteHost(host)))
      .get();
    return result ?? null;
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);
    const result = await db
      .select()
      .from(widgetSites)
      .where(eq(widgetSites.id, id))
      .get();
    return result ?? null;
  },

  async list(d1: D1Database) {
    const db = createDb(d1);
    return await db.select().from(widgetSites).all();
  },

  async create(d1: D1Database, input: CreateInput) {
    const db = createDb(d1);
    return await db
      .insert(widgetSites)
      .values({
        id: input.id,
        host: normalizeSiteHost(input.host),
        instructions: input.instructions,
        createdAt: input.createdAt,
      })
      .returning()
      .get();
  },

  async update(
    d1: D1Database,
    id: string,
    input: Partial<Pick<WidgetSite, "host" | "instructions">>,
  ) {
    const db = createDb(d1);
    return await db
      .update(widgetSites)
      .set({
        ...input,
        ...(input.host && { host: normalizeSiteHost(input.host) }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(widgetSites.id, id))
      .returning()
      .get();
  },

  async delete(d1: D1Database, id: string) {
    const db = createDb(d1);
    await db.delete(widgetSites).where(eq(widgetSites.id, id));
  },
};

export type { WidgetSite };
