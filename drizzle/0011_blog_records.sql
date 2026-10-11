CREATE TABLE `blog_records` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`summary` text,
	`category` text NOT NULL,
	`tags_json` text NOT NULL,
	`body` text NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_records_slug_unique` ON `blog_records` (`slug`);--> statement-breakpoint
CREATE INDEX `blog_records_public_idx` ON `blog_records` (`published`,`archived`,`featured`);