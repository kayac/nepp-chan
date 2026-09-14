ALTER TABLE `llm_usage` ADD COLUMN `turn_id` text;
ALTER TABLE `llm_usage` DROP COLUMN `turn_index`;
CREATE INDEX IF NOT EXISTS `idx_llm_usage_thread_id` ON `llm_usage`(`thread_id`);
