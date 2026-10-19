CREATE TABLE `content_public_slugs` (
	`path` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`first_observed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `content_public_slugs_entity_idx` ON `content_public_slugs` (`entity_type`,`entity_id`);
