DELETE FROM persona;
DELETE FROM thread_persona_status;
DROP INDEX IF EXISTS idx_persona_resource_id;
ALTER TABLE persona DROP COLUMN resource_id;
