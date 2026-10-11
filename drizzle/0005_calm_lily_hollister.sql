CREATE TABLE `lab_records` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`category` text,
	`tags_json` text NOT NULL,
	`visible` integer DEFAULT false NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`repo` text,
	`demo` text,
	`related_project` text,
	`tools_json` text NOT NULL,
	`lessons_json` text NOT NULL,
	`risk` text,
	`body` text NOT NULL,
	`replaces_mdx` integer DEFAULT false NOT NULL,
	`date` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lab_records_slug_unique` ON `lab_records` (`slug`);--> statement-breakpoint
CREATE INDEX `lab_records_public_idx` ON `lab_records` (`visible`,`featured`);