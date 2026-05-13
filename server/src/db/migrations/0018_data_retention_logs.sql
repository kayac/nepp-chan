CREATE TABLE data_retention_logs (
  id TEXT PRIMARY KEY NOT NULL,
  executed_at TEXT NOT NULL,
  target_table TEXT NOT NULL,
  deleted_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
