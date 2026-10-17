ALTER TABLE `blog_records` ADD `cover` text;--> statement-breakpoint
ALTER TABLE `project_records` ADD `screenshots_json` text DEFAULT '[]' NOT NULL;