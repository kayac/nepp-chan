DROP TABLE IF EXISTS questionnaire_answers;
DROP TABLE IF EXISTS questionnaire_submissions;
DROP TABLE IF EXISTS questionnaire_questions;
DROP TABLE IF EXISTS questionnaires;

CREATE TABLE polls (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  choices TEXT NOT NULL,
  follow_up_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  scheduled_at TEXT,
  sent_at TEXT,
  closed_at TEXT
);

CREATE TABLE poll_submissions (
  id TEXT PRIMARY KEY NOT NULL,
  poll_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  selected_choice TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_poll_submissions_unique ON poll_submissions (poll_id, user_id);
CREATE INDEX idx_poll_submissions_poll ON poll_submissions (poll_id);
