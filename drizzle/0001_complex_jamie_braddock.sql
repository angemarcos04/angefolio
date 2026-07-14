CREATE TABLE `project_records` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`category` text,
	`role` text,
	`problem` text,
	`solution` text,
	`stack_json` text NOT NULL,
	`links_json` text NOT NULL,
	`github` text,
	`demo` text,
	`case_study_body` text,
	`featured` integer DEFAULT false NOT NULL,
	`visible` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`order_index` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_records_slug_unique` ON `project_records` (`slug`);--> statement-breakpoint
CREATE INDEX `project_records_public_idx` ON `project_records` (`visible`,`archived`,`featured`);