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
