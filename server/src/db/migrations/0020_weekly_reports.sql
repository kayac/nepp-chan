-- 週次レポート（数値集計 + LLM ハイライト要約の恒久記録）
CREATE TABLE IF NOT EXISTS weekly_reports (
  id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  stats TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_reports_period_start ON weekly_reports(period_start);
