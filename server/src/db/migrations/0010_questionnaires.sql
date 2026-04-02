CREATE TABLE `questionnaires` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`is_anonymous` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	`sent_at` text,
	`closed_at` text
);

CREATE TABLE `questionnaire_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`questionnaire_id` text NOT NULL,
	`order` integer NOT NULL,
	`text` text NOT NULL,
	`type` text NOT NULL,
	`required` integer DEFAULT 1 NOT NULL,
	`choices` text,
	`created_at` text NOT NULL
);

CREATE TABLE `questionnaire_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`questionnaire_id` text NOT NULL,
	`user_id` text NOT NULL,
	`current_question_order` integer DEFAULT 1 NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL
);

CREATE UNIQUE INDEX `idx_submissions_unique` ON `questionnaire_submissions` (`questionnaire_id`, `user_id`);

CREATE TABLE `questionnaire_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`question_id` text NOT NULL,
	`answer_text` text,
	`answer_number` integer,
	`selected_choices` text,
	`created_at` text NOT NULL
);
