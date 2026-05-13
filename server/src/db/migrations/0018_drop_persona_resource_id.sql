-- 案 C: resource_id 廃止 + 既存レコード全削除（個人紐付け解除）
-- persona テーブル自体は今後の抽象化集合知の入れ物として残す
DELETE FROM persona;
DELETE FROM thread_persona_status;
DROP INDEX IF EXISTS idx_persona_resource_id;
ALTER TABLE persona DROP COLUMN resource_id;
