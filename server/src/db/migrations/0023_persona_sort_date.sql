-- 一覧の期間絞り込みと並びは COALESCE(conversation_ended_at, created_at) 基準。
-- 式のままでは index が使えないため生成列として持たせる
ALTER TABLE persona ADD COLUMN sort_date TEXT GENERATED ALWAYS AS (COALESCE(conversation_ended_at, created_at)) VIRTUAL;

CREATE INDEX IF NOT EXISTS idx_persona_sort_date ON persona(sort_date);
