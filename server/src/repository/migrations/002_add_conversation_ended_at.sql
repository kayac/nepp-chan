-- persona テーブルに会話最終時刻カラムを追加
ALTER TABLE persona ADD COLUMN conversation_ended_at TEXT;

CREATE INDEX IF NOT EXISTS idx_persona_conversation_ended_at ON persona(conversation_ended_at);
