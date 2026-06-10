import { desc, eq } from "drizzle-orm";
import { createDb, type NewWeeklyReport, weeklyReports } from "~/db";

export const weeklyReportRepository = {
  // period_start UNIQUE 制約により、cron 再実行や手動再生成で重複させない
  async upsert(d1: D1Database, input: NewWeeklyReport) {
    const db = createDb(d1);

    await db
      .insert(weeklyReports)
      .values(input)
      .onConflictDoUpdate({
        target: weeklyReports.periodStart,
        set: {
          periodEnd: input.periodEnd,
          stats: input.stats,
          summary: input.summary,
          createdAt: input.createdAt,
        },
      });
  },

  async list(d1: D1Database, params: { limit: number }) {
    const db = createDb(d1);

    return db
      .select()
      .from(weeklyReports)
      .orderBy(desc(weeklyReports.periodStart))
      .limit(params.limit)
      .all();
  },

  async findById(d1: D1Database, id: string) {
    const db = createDb(d1);

    return db
      .select()
      .from(weeklyReports)
      .where(eq(weeklyReports.id, id))
      .get();
  },
};
