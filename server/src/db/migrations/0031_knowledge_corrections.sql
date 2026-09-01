CREATE TABLE knowledge_corrections (
  id TEXT PRIMARY KEY,
  corrects_source_path TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  verified_at TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  related_feedback_id TEXT,
  answer_run_id TEXT,
  needs_review_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX idx_knowledge_corrections_corrects ON knowledge_corrections(corrects_source_path);
