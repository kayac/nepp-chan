CREATE TABLE `broadcast_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` text,
	`sent_at` text,
	`error_message` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text
);
