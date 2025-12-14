-- 初期スキーマ定義
-- 新規環境セットアップ時にこのファイルを実行

-- 緊急事態報告テーブル
CREATE TABLE IF NOT EXISTS emergency_reports (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  description TEXT,
  location TEXT,
  reported_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_emergency_reports_type ON emergency_reports(type);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_reported_at ON emergency_reports(reported_at);

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
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_persona_resource_id ON persona(resource_id);
CREATE INDEX IF NOT EXISTS idx_persona_category ON persona(category);
CREATE INDEX IF NOT EXISTS idx_persona_created_at ON persona(created_at);
CREATE INDEX IF NOT EXISTS idx_persona_topic ON persona(topic);
CREATE INDEX IF NOT EXISTS idx_persona_sentiment ON persona(sentiment);
