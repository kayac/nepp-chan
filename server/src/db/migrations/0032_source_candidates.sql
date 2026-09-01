CREATE TABLE source_candidates (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  related_answer_run_id TEXT,
  decided_by TEXT,
  decided_at TEXT,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX idx_source_candidates_status ON source_candidates(status);
