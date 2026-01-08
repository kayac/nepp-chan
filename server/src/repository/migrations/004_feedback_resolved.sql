-- フィードバックに解決済みステータスを追加

ALTER TABLE message_feedback ADD COLUMN resolved_at TEXT;
