import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export const createDb = (d1: D1Database) => drizzle(d1, { schema });

export type DbClient = ReturnType<typeof createDb>;
