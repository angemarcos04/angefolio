CREATE TABLE `content_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`actor_user_id` text,
	`restored_from_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `content_revisions_entity_idx` ON `content_revisions` (`entity_type`,`entity_id`,`created_at`);
--> statement-breakpoint
INSERT INTO `content_revisions` (`id`,`entity_type`,`entity_id`,`snapshot_json`,`actor_user_id`,`restored_from_id`,`created_at`)
SELECT lower(hex(randomblob(16))), 'project', `id`, json_object(
  'id',`id`,'slug',`slug`,'title',`title`,'description',`description`,'status',`status`,
  'category',`category`,'role',`role`,'problem',`problem`,'solution',`solution`,
  'stack',json(`stack_json`),'links',json(`links_json`),'github',`github`,'demo',`demo`,
  'caseStudyBody',`case_study_body`,'projectDate',`project_date`,
  'highlights',json(`highlights_json`),'cover',`cover`,'replacesMdx',`replaces_mdx`,
  'featured',`featured`,'visible',`visible`,'archived',`archived`,
  'statusBeforeArchive',`status_before_archive`,'orderIndex',`order_index`,
  'createdAt',`created_at`,'updatedAt',`updated_at`
), NULL, NULL, CAST(strftime('%s','now') AS integer)
FROM `project_records`;
--> statement-breakpoint
INSERT INTO `content_revisions` (`id`,`entity_type`,`entity_id`,`snapshot_json`,`actor_user_id`,`restored_from_id`,`created_at`)
SELECT lower(hex(randomblob(16))), 'note', `id`, json_object(
  'id',`id`,'slug',`slug`,'title',`title`,'description',`description`,'summary',`summary`,
  'category',`category`,'tags',json(`tags_json`),'body',`body`,'published',`published`,
  'featured',`featured`,'replacesMdx',`replaces_mdx`,'createdAt',`created_at`,'updatedAt',`updated_at`
), NULL, NULL, CAST(strftime('%s','now') AS integer)
FROM `note_records`;
--> statement-breakpoint
INSERT INTO `content_revisions` (`id`,`entity_type`,`entity_id`,`snapshot_json`,`actor_user_id`,`restored_from_id`,`created_at`)
SELECT lower(hex(randomblob(16))), 'lab', `id`, json_object(
  'id',`id`,'slug',`slug`,'title',`title`,'description',`description`,'status',`status`,
  'category',`category`,'tags',json(`tags_json`),'visible',`visible`,'featured',`featured`,
  'repo',`repo`,'demo',`demo`,'relatedProject',`related_project`,'tools',json(`tools_json`),
  'lessons',json(`lessons_json`),'risk',`risk`,'body',`body`,'replacesMdx',`replaces_mdx`,
  'date',`date`,'updatedAt',`updated_at`
), NULL, NULL, CAST(strftime('%s','now') AS integer)
FROM `lab_records`;
--> statement-breakpoint
INSERT INTO `content_revisions` (`id`,`entity_type`,`entity_id`,`snapshot_json`,`actor_user_id`,`restored_from_id`,`created_at`)
SELECT lower(hex(randomblob(16))), 'now_status', `id`, json_object(
  'id',`id`,'currentFocus',`current_focus`,'workingOn',json(`working_on`),
  'learning',json(`learning`),'using',json(`using`),'statusNote',`status_note`,
  'published',`published`,'updatedAt',`updated_at`
), NULL, NULL, CAST(strftime('%s','now') AS integer)
FROM `now_status`;
