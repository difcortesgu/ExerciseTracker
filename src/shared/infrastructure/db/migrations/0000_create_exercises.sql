CREATE TABLE `exercise_library_seed` (
	`id` integer PRIMARY KEY NOT NULL,
	`seed_version` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exercise_vocabulary_values` (
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`origin` text NOT NULL,
	`label` text NOT NULL,
	PRIMARY KEY(`kind`, `key`, `origin`)
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`origin` text NOT NULL,
	`source_key` text,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`category` text NOT NULL,
	`equipment` text,
	`level` text,
	`force` text,
	`mechanic` text,
	`primary_muscles` text NOT NULL,
	`secondary_muscles` text NOT NULL,
	`instructions` text NOT NULL,
	`images` text NOT NULL,
	`tracked_metrics` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_source_key_unique` ON `exercises` (`source_key`);--> statement-breakpoint
CREATE INDEX `exercises_name_key_idx` ON `exercises` (`name_key`);--> statement-breakpoint
CREATE INDEX `exercises_archived_idx` ON `exercises` (`archived`);