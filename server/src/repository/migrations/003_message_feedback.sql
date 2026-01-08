-- メッセージフィードバックテーブル
-- ねっぷちゃんの回答に対するユーザーフィードバックを記録

CREATE TABLE IF NOT EXISTS message_feedback (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  rating TEXT NOT NULL,
  category TEXT,
  comment TEXT,
  conversation_context TEXT NOT NULL,
  tool_executions TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_feedback_thread_id ON message_feedback(thread_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_rating ON message_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_message_feedback_category ON message_feedback(category);
CREATE INDEX IF NOT EXISTS idx_message_feedback_created_at ON message_feedback(created_at);
