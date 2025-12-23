CREATE TABLE IF NOT EXISTS thread_persona_status (
  thread_id TEXT PRIMARY KEY,
  last_extracted_at TEXT,
  last_message_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_thread_persona_status_last_extracted_at ON thread_persona_status(last_extracted_at);
