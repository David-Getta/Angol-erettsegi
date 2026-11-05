CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`section` text NOT NULL,
	`seconds` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_day` ON `activity` (`day`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL,
	`section` text NOT NULL,
	`level` text NOT NULL,
	`mode` text NOT NULL,
	`answers` text NOT NULL,
	`results` text NOT NULL,
	`score` real NOT NULL,
	`max_score` real NOT NULL,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	`mock_exam_id` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attempts_task` ON `attempts` (`task_id`);--> statement-breakpoint
CREATE INDEX `attempts_section` ON `attempts` (`section`,`level`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_key` text NOT NULL,
	`front` text NOT NULL,
	`back` text DEFAULT '' NOT NULL,
	`example` text,
	`collocation` text,
	`type` text NOT NULL,
	`incomplete` integer DEFAULT false NOT NULL,
	`fsrs_state` text,
	`due_at` integer NOT NULL,
	`is_new` integer DEFAULT true NOT NULL,
	`suspended` integer DEFAULT false NOT NULL,
	`topic` text,
	`level` text,
	`source_type` text NOT NULL,
	`source_id` text,
	`context` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cards_note_type` ON `cards` (`note_key`,`type`);--> statement-breakpoint
CREATE INDEX `cards_due` ON `cards` (`due_at`);--> statement-breakpoint
CREATE TABLE `errors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`original` text NOT NULL,
	`corrected` text NOT NULL,
	`explanation` text NOT NULL,
	`context` text,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`task_id` text,
	`item_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `errors_category` ON `errors` (`category`);--> statement-breakpoint
CREATE INDEX `errors_created` ON `errors` (`created_at`);--> statement-breakpoint
CREATE TABLE `item_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL,
	`item_id` text NOT NULL,
	`category` text NOT NULL,
	`section` text NOT NULL,
	`correct` integer NOT NULL,
	`answer` text NOT NULL,
	`mode` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `item_attempts_category` ON `item_attempts` (`category`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mock_exams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'mock' NOT NULL,
	`level` text NOT NULL,
	`status` text NOT NULL,
	`plan` text NOT NULL,
	`current_part` integer DEFAULT 0 NOT NULL,
	`part_started_at` integer,
	`section_scores` text,
	`total_pct` real,
	`result` text,
	`created_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`card_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`was_new` integer DEFAULT false NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`reviewed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`task_id` text NOT NULL,
	`level` text NOT NULL,
	`text` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`parent_id` text,
	`root_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`mode` text DEFAULT 'practice' NOT NULL,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	`transcript_source` text,
	`feedback` text,
	`score` real,
	`max_score` real,
	`graded_by` text,
	`mock_exam_id` integer,
	`created_at` integer NOT NULL,
	`graded_at` integer
);
--> statement-breakpoint
CREATE INDEX `submissions_status` ON `submissions` (`status`);--> statement-breakpoint
CREATE INDEX `submissions_root` ON `submissions` (`root_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`section` text NOT NULL,
	`type` text NOT NULL,
	`level` text NOT NULL,
	`source` text NOT NULL,
	`topic` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`answer_key` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`categories` text DEFAULT '[]' NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`reserved_for` text,
	`content_file` text NOT NULL,
	`content_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_section_level` ON `tasks` (`section`,`level`);