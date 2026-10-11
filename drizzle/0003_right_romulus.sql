ALTER TABLE `project_records` ADD `project_date` integer;--> statement-breakpoint
ALTER TABLE `project_records` ADD `highlights_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_records` ADD `cover` text;--> statement-breakpoint
ALTER TABLE `project_records` ADD `replaces_mdx` integer DEFAULT false NOT NULL;