import { Mastra } from "@mastra/core/mastra";
import { and, gte, lt } from "drizzle-orm";
import { createDb, persona } from "~/db";
import { DAY_MS, jstDateLabel, startOfJstWeek, WEEK_MS } from "~/lib/date";
import { OPENAI_MAIN } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { getStorage } from "~/lib/storage";
import { weeklyReportAgent } from "~/mastra/agents/weekly-report-agent";
import { createRequestContext } from "~/mastra/request-context";
import { weeklyReportRepository } from "~/repository/weekly-report-repository";
import type { WeeklyStats } from "~/schemas/analytics-schema";
import {
  getConversationStats,
  getUsageByModel,
} from "~/services/analytics/aggregate";
import { recordLlmUsage } from "~/services/analytics/llm-usage";

const NO_VOICE_SUMMARY = "この週に抽出された村の声はありませんでした。";

/** 実行時刻を含む週の前週（JST 月〜日）をレポート対象期間とする */
export const resolveReportPeriod = (now: Date) => {
  const thisWeekStart = startOfJstWeek(now);
  const prevWeekStart = new Date(thisWeekStart.getTime() - WEEK_MS);

  return {
    periodStart: jstDateLabel(prevWeekStart),
    periodEnd: jstDateLabel(new Date(thisWeekStart.getTime() - DAY_MS)),
    from: prevWeekStart.toISOString(),
    to: thisWeekStart.toISOString(),
  };
};

/**
 * 対象週に抽出された persona から週次ハイライトを生成する。
 * raw 会話ではなく persona を入力にするのは、匿名化済み・要約済みで
 * トークン量と個人情報リスクを抑えられるため。
 */
const generateWeeklySummary = async (
  env: CloudflareBindings,
  period: { from: string; to: string },
) => {
  const db = createDb(env.DB);

  const voices = await db
    .select({
      category: persona.category,
      topic: persona.topic,
      sentiment: persona.sentiment,
      content: persona.content,
    })
    .from(persona)
    .where(
      and(
        gte(persona.createdAt, period.from),
        lt(persona.createdAt, period.to),
      ),
    )
    .all();

  if (voices.length === 0) {
    return NO_VOICE_SUMMARY;
  }

  const voiceLines = voices
    .map(
      (v) =>
        `- [${v.topic ?? "その他"} / ${v.category} / ${v.sentiment ?? "neutral"}] ${v.content}`,
    )
    .join("\n");

  const storage = await getStorage(env.DB);
  const mastra = new Mastra({
    agents: { weeklyReportAgent },
    storage,
  });
  const agent = mastra.getAgent("weeklyReportAgent");
  const requestContext = createRequestContext({
    storage,
    db: env.DB,
    env,
  });

  const response = await agent.generate(
    `以下は今週抽出された村の声（${voices.length} 件）です。週次ハイライトを書いてください。\n\n${voiceLines}`,
    { requestContext },
  );

  await recordLlmUsage(env.DB, {
    model: OPENAI_MAIN,
    usage: response.totalUsage,
    source: "weekly-report",
    agent: "weekly-report",
  });

  return response.text;
};

export const runWeeklyReport = async (
  env: CloudflareBindings,
  options: { now?: Date } = {},
) => {
  const now = options.now ?? new Date();
  const period = resolveReportPeriod(now);

  logger.info(
    `[WeeklyReport] generating report for ${period.periodStart} - ${period.periodEnd}`,
  );

  const [conversation, usageByModel] = await Promise.all([
    getConversationStats(env.DB, { from: period.from, to: period.to }),
    getUsageByModel(env.DB, { from: period.from, to: period.to }),
  ]);

  const stats: WeeklyStats = {
    conversationCount: conversation.totals.conversations,
    messageCount: conversation.totals.messages,
    hourly: conversation.hourly,
    platforms: conversation.platforms,
    usageByModel,
  };

  const summary = await generateWeeklySummary(env, period);

  await weeklyReportRepository.upsert(env.DB, {
    id: crypto.randomUUID(),
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    stats: JSON.stringify(stats),
    summary,
    createdAt: new Date().toISOString(),
  });

  logger.info(`[WeeklyReport] saved report for ${period.periodStart}`);

  return { period, stats };
};
