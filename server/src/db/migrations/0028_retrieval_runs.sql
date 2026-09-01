CREATE TABLE retrieval_runs (
  id TEXT PRIMARY KEY,
  answer_run_id TEXT,
  thread_id TEXT,
  message_id TEXT,
  turn_index INTEGER,
  query TEXT NOT NULL,
  hits TEXT NOT NULL,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_retrieval_runs_answer_run ON retrieval_runs(answer_run_id);
CREATE INDEX idx_retrieval_runs_thread ON retrieval_runs(thread_id, turn_index);
CREATE INDEX idx_retrieval_runs_created_at ON retrieval_runs(created_at);
