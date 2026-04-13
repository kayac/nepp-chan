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

export const mastraMessages = sqliteTable("mastra_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
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

// アンケート
export const questionnaires = sqliteTable("questionnaires", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  isAnonymous: integer("is_anonymous").notNull().default(1), // 1=無記名, 0=記名
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

export type Questionnaire = typeof questionnaires.$inferSelect;
export type NewQuestionnaire = typeof questionnaires.$inferInsert;

// アンケート設問
export const questionnaireQuestions = sqliteTable("questionnaire_questions", {
  id: text("id").primaryKey(),
  questionnaireId: text("questionnaire_id").notNull(),
  order: integer("order").notNull(),
  text: text("text").notNull(),
  type: text("type")
    .$type<"single_choice" | "multiple_choice" | "free_text" | "rating">()
    .notNull(),
  required: integer("required").notNull().default(1), // 1=必須, 0=任意
  choices: text("choices"), // JSON: string[] (選択式の場合)
  createdAt: text("created_at").notNull(),
});

export type QuestionnaireQuestion = typeof questionnaireQuestions.$inferSelect;
export type NewQuestionnaireQuestion =
  typeof questionnaireQuestions.$inferInsert;

// アンケート提出（ユーザーごとの重複防止）
export const questionnaireSubmissions = sqliteTable(
  "questionnaire_submissions",
  {
    id: text("id").primaryKey(),
    questionnaireId: text("questionnaire_id").notNull(),
    userId: text("user_id").notNull(),
    currentQuestionOrder: integer("current_question_order")
      .notNull()
      .default(1),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull(),
  },
);

export type QuestionnaireSubmission =
  typeof questionnaireSubmissions.$inferSelect;
export type NewQuestionnaireSubmission =
  typeof questionnaireSubmissions.$inferInsert;

// アンケート回答
export const questionnaireAnswers = sqliteTable("questionnaire_answers", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull(),
  questionId: text("question_id").notNull(),
  answerText: text("answer_text"), // free_text の回答
  answerNumber: integer("answer_number"), // rating の回答
  selectedChoices: text("selected_choices"), // JSON: string[] (選択式の回答)
  createdAt: text("created_at").notNull(),
});

export type QuestionnaireAnswer = typeof questionnaireAnswers.$inferSelect;
export type NewQuestionnaireAnswer = typeof questionnaireAnswers.$inferInsert;

// 管理者セッション（opaque token）
export const adminSessions = sqliteTable("admin_sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export type AdminSession = typeof adminSessions.$inferSelect;
export type NewAdminSession = typeof adminSessions.$inferInsert;
