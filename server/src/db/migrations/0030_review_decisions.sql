CREATE TABLE review_decisions (
  id TEXT PRIMARY KEY,
  answer_run_id TEXT NOT NULL,
  feedback_id TEXT,
  decision TEXT NOT NULL,
  comment TEXT,
  reviewed_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_review_decisions_answer_run ON review_decisions(answer_run_id);
CREATE INDEX idx_llm_usage_thread_turn_agent ON llm_usage(thread_id, turn_index, agent);
CREATE INDEX idx_message_feedback_message_id ON message_feedback(message_id);
