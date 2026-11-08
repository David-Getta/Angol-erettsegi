DROP INDEX `cards_note_type`;--> statement-breakpoint
ALTER TABLE `cards` ADD `subject` text DEFAULT 'angol' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `cards_subject_note_type` ON `cards` (`subject`,`note_key`,`type`);--> statement-breakpoint
ALTER TABLE `activity` ADD `subject` text DEFAULT 'angol' NOT NULL;--> statement-breakpoint
ALTER TABLE `attempts` ADD `subject` text DEFAULT 'angol' NOT NULL;--> statement-breakpoint
ALTER TABLE `errors` ADD `subject` text DEFAULT 'angol' NOT NULL;--> statement-breakpoint
ALTER TABLE `item_attempts` ADD `subject` text DEFAULT 'angol' NOT NULL;--> statement-breakpoint
ALTER TABLE `mock_exams` ADD `subject` text DEFAULT 'angol' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `subject` text DEFAULT 'angol' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `subject` text DEFAULT 'angol' NOT NULL;--> statement-breakpoint
CREATE INDEX `tasks_subject` ON `tasks` (`subject`);