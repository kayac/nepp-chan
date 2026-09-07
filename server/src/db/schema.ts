import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// 緊急報告
export const emergencyReports = sqliteTable("emergency_reports", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  description: text("description"),
  location: text("location"),
  reportedAt: text("reported_at").notNull(),
  updatedAt: text("updated_at"),
});

// ペルソナ（村の集合知）
export const persona = sqliteTable("persona", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  tags: text("tags"),
  content: text("content").notNull(),
  source: text("source"),
  topic: text("topic"),
  sentiment: text("sentiment").default("neutral"),
  demographicSummary: text("demographic_summary"),
  entities: text("entities"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
  conversationEndedAt: text("conversation_ended_at"),
});

// スレッドペルソナ処理状態
export const threadPersonaStatus = sqliteTable("thread_persona_status", {
  threadId: text("thread_id").primaryKey(),
  lastExtractedAt: text("last_extracted_at"),
  lastMessageCount: integer("last_message_count"),
});

// Mastra 管理テーブル（読み取り専用スキーマ）
// マイグレーション対象外：tablesFilter で除外
export const mastraThreads = sqliteTable("mastra_threads", {
  id: text("id").primaryKey(),
  resourceId: text("resourceId"),
  createdAt: text("createdAt"),
});

export const mastraMessages = sqliteTable("mastra_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  role: text("role"),
  createdAt: text("createdAt"),
});

export const mastraResources = sqliteTable("mastra_resources", {
  id: text("id").primaryKey(),
  updatedAt: text("updatedAt"),
});

// 型エクスポート
export type EmergencyReport = typeof emergencyReports.$inferSelect;
export type NewEmergencyReport = typeof emergencyReports.$inferInsert;

export type Persona = typeof persona.$inferSelect;
export type NewPersona = typeof persona.$inferInsert;

export type ThreadPersonaStatus = typeof threadPersonaStatus.$inferSelect;
export type NewThreadPersonaStatus = typeof threadPersonaStatus.$inferInsert;

export type MastraThread = typeof mastraThreads.$inferSelect;

// メッセージフィードバック
export const messageFeedback = sqliteTable("message_feedback", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  messageId: text("message_id").notNull(),
  rating: text("rating").notNull(), // "good" | "bad"
  category: text("category"), // "incorrect_fact" | "outdated_info" | "nonexistent_info" | "off_topic" | "other"
  comment: text("comment"),
  conversationContext: text("conversation_context").notNull(), // JSON
  toolExecutions: text("tool_executions"), // JSON
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"), // 解決日時（null = 未解決）
});

export type MessageFeedback = typeof messageFeedback.$inferSelect;
export type NewMessageFeedback = typeof messageFeedback.$inferInsert;

// 管理者ユーザー
export const adminUsers = sqliteTable("admin_users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name"),
  role: text("role").notNull().default("admin"), // "super_admin" | "admin" | "staff"
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;

// 管理者招待
export const adminInvitations = sqliteTable("admin_invitations", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by").notNull(), // 初期は "system"
  role: text("role").notNull().default("admin"),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),
});

export type AdminInvitation = typeof adminInvitations.$inferSelect;
export type NewAdminInvitation = typeof adminInvitations.$inferInsert;

// LINE配信メッセージ
export const broadcastMessages = sqliteTable("broadcast_messages", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  parts: text("parts"),
  status: text("status").notNull().default("draft"), // draft | scheduled | sent | failed
  scheduledAt: text("scheduled_at"),
  sentAt: text("sent_at"),
  errorMessage: text("error_message"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export type BroadcastMessage = typeof broadcastMessages.$inferSelect;
export type NewBroadcastMessage = typeof broadcastMessages.$inferInsert;

// 投票
export const polls = sqliteTable("polls", {
  id: text("id").primaryKey(),
  title: text("title").notNull(), // お題
  choices: text("choices").notNull(), // JSON: string[]
  followUpPrompt: text("follow_up_prompt"), // 回答後にねっぷちゃんが話題を広げるヒント
  status: text("status")
    .$type<"draft" | "scheduled" | "sent" | "closed">()
    .notNull()
    .default("draft"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
  scheduledAt: text("scheduled_at"),
  sentAt: text("sent_at"),
  closedAt: text("closed_at"),
});

export type Poll = typeof polls.$inferSelect;
export type NewPoll = typeof polls.$inferInsert;

// 投票回答
export const pollSubmissions = sqliteTable("poll_submissions", {
  id: text("id").primaryKey(),
  pollId: text("poll_id").notNull(),
  userId: text("user_id").notNull(),
  selectedChoice: text("selected_choice").notNull(),
  createdAt: text("created_at").notNull(),
});

export type PollSubmission = typeof pollSubmissions.$inferSelect;
export type NewPollSubmission = typeof pollSubmissions.$inferInsert;

// 管理者セッション（opaque token）
export const adminSessions = sqliteTable("admin_sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export type AdminSession = typeof adminSessions.$inferSelect;
export type NewAdminSession = typeof adminSessions.$inferInsert;

// ユーザー別配信注入状態
export const userBroadcastState = sqliteTable("user_broadcast_state", {
  userId: text("user_id").primaryKey(),
  lastInjectedAt: text("last_injected_at").notNull(),
});

export type UserBroadcastState = typeof userBroadcastState.$inferSelect;

// ユーザー別投票注入状態
export const userPollState = sqliteTable("user_poll_state", {
  userId: text("user_id").primaryKey(),
  lastInjectedAt: text("last_injected_at").notNull(),
});

export type UserPollState = typeof userPollState.$inferSelect;

// LLM 呼び出しごとのトークン使用量記録
export const llmUsage = sqliteTable("llm_usage", {
  id: text("id").primaryKey(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  reasoningTokens: integer("reasoning_tokens").notNull().default(0),
  cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  platform: text("platform"), // "web" | "line" | "lp" | "widget" | "voice" | null（バッチ系）
  source: text("source").notNull(),
  agent: text("agent"), // 呼び出し元エージェント名（"nepp-chan" "knowledge" 等）。列追加前の行は null
  turnIndex: integer("turn_index"), // スレッド内の何往復目か（1 始まり）。列追加前の行は null
  durationMs: integer("duration_ms"), // 呼び出し 1 回の所要時間
  intent: text("intent"), // "casual" | "thinking"
  threadId: text("thread_id"),
  // 記録時点の単価による確定額（USD）。単価変動後も過去実績が書き換わらないよう永続化する。
  // NULL はコスト永続化開始前の行で、集計時に現行単価で概算する
  costUsd: real("cost_usd"),
  createdAt: text("created_at").notNull(),
});

export type LlmUsage = typeof llmUsage.$inferSelect;
export type NewLlmUsage = typeof llmUsage.$inferInsert;

// 週次レポート（数値集計 + LLM ハイライト要約の恒久記録）
export const weeklyReports = sqliteTable("weekly_reports", {
  id: text("id").primaryKey(),
  periodStart: text("period_start").notNull(), // 週初め月曜の JST 日付（UNIQUE）
  periodEnd: text("period_end").notNull(), // 週末日曜の JST 日付
  stats: text("stats").notNull(), // JSON（WeeklyStats）
  summary: text("summary").notNull(),
  createdAt: text("created_at").notNull(),
});

export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type NewWeeklyReport = typeof weeklyReports.$inferInsert;

// 保管期間ポリシーによる削除実行ログ
export const dataRetentionLogs = sqliteTable("data_retention_logs", {
  id: text("id").primaryKey(),
  executedAt: text("executed_at").notNull(),
  targetTable: text("target_table").notNull(),
  deletedCount: integer("deleted_count").notNull(),
  createdAt: text("created_at").notNull(),
});

export type DataRetentionLog = typeof dataRetentionLogs.$inferSelect;
export type NewDataRetentionLog = typeof dataRetentionLogs.$inferInsert;

export const widgetSites = sqliteTable("widget_sites", {
  id: text("id").primaryKey(),
  host: text("host").notNull().unique(),
  instructions: text("instructions").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export type WidgetSite = typeof widgetSites.$inferSelect;
export type NewWidgetSite = typeof widgetSites.$inferInsert;
