-- 村の集合知（ペルソナ）テーブル
-- ユーザーの好み、過去の決定事項、村の価値観、回答傾向などを抽象化して蓄積
CREATE TABLE IF NOT EXISTS persona (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT,
  content TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_persona_resource_id ON persona(resource_id);
CREATE INDEX IF NOT EXISTS idx_persona_category ON persona(category);
CREATE INDEX IF NOT EXISTS idx_persona_created_at ON persona(created_at);
