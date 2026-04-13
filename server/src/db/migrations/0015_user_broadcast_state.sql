CREATE TABLE IF NOT EXISTS user_broadcast_state (
  user_id TEXT PRIMARY KEY,
  last_injected_at TEXT NOT NULL
);
