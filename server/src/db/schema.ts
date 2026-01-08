import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  resourceId: text("resource_id").notNull(),
  category: text("category").notNull(),
  tags: text("tags"),
  content: text("content").notNull(),
  source: text("source"),
  topic: text("topic"),
  sentiment: text("sentiment").default("neutral"),
  demographicSummary: text("demographic_summary"),
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
