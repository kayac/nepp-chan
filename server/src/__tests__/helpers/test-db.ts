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
      resource_id TEXT NOT NULL,
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

  `);

  return drizzle(client, { schema });
};

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
