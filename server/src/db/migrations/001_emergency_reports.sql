-- 緊急事態報告テーブル
CREATE TABLE IF NOT EXISTS emergency_reports (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  description TEXT,
  location TEXT,
  reported_at TEXT NOT NULL,
  updated_at TEXT
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_emergency_reports_type ON emergency_reports(type);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_reported_at ON emergency_reports(reported_at);
