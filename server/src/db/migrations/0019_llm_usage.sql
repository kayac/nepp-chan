-- LLM 呼び出しごとのトークン使用量記録
CREATE TABLE IF NOT EXISTS llm_usage (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  platform TEXT,
  source TEXT NOT NULL,
  intent TEXT,
  thread_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON llm_usage(created_at);
