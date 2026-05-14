import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "~/db/schema";

// テスト用インメモリ SQLite DB を作成
export const createTestDb = async () => {
  const client = createClient({ url: ":memory:" });

  // マイグレーション SQL を実行
  await client.executeMultiple(`
    -- 緊急事態報告テーブル
    CREATE TABLE IF NOT EXISTS emergency_reports (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      description TEXT,
      location TEXT,
      reported_at TEXT NOT NULL,
      updated_at TEXT
    );

    -- 村の集合知（ペルソナ）テーブル
    CREATE TABLE IF NOT EXISTS persona (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      tags TEXT,
      content TEXT NOT NULL,
      source TEXT,
      topic TEXT,
      sentiment TEXT DEFAULT 'neutral',
      demographic_summary TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      conversation_ended_at TEXT
    );

    -- スレッドペルソナ処理状態テーブル
    CREATE TABLE IF NOT EXISTS thread_persona_status (
      thread_id TEXT PRIMARY KEY,
      last_extracted_at TEXT,
      last_message_count INTEGER DEFAULT 0
    );

    -- メッセージフィードバック
    CREATE TABLE IF NOT EXISTS message_feedback (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      rating TEXT NOT NULL,
      category TEXT,
      comment TEXT,
      conversation_context TEXT NOT NULL,
      tool_executions TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    -- 管理者ユーザー
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'admin',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    -- 管理者招待
    CREATE TABLE IF NOT EXISTS admin_invitations (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      token TEXT NOT NULL UNIQUE,
      invited_by TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    -- 管理者セッション（opaque token）
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- LINE 配信メッセージ
    CREATE TABLE IF NOT EXISTS broadcast_messages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      parts TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TEXT,
      sent_at TEXT,
      error_message TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    -- 投票
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      choices TEXT NOT NULL,
      follow_up_prompt TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      scheduled_at TEXT,
      sent_at TEXT,
      closed_at TEXT
    );

    -- 投票回答
    CREATE TABLE IF NOT EXISTS poll_submissions (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      selected_choice TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS poll_submissions_poll_user_unique
      ON poll_submissions (poll_id, user_id);

    -- ユーザー別配信注入状態
    CREATE TABLE IF NOT EXISTS user_broadcast_state (
      user_id TEXT PRIMARY KEY,
      last_injected_at TEXT NOT NULL
    );

    -- ユーザー別投票注入状態
    CREATE TABLE IF NOT EXISTS user_poll_state (
      user_id TEXT PRIMARY KEY,
      last_injected_at TEXT NOT NULL
    );

    -- 保管期間ポリシー削除実行ログ
    CREATE TABLE IF NOT EXISTS data_retention_logs (
      id TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL,
      target_table TEXT NOT NULL,
      deleted_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Mastra 管理テーブル（read-only スキーマ。テストのフィクスチャ生成用に最低限のカラムを定義）
    CREATE TABLE IF NOT EXISTS mastra_threads (
      id TEXT PRIMARY KEY,
      resourceId TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS mastra_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS mastra_resources (
      id TEXT PRIMARY KEY,
      updatedAt TEXT
    );
  `);

  return drizzle(client, { schema });
};

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
