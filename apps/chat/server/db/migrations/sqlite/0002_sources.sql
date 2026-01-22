CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`repo` text,
	`branch` text,
	`content_path` text,
	`output_path` text,
	`readme_only` integer DEFAULT false,
	`channel_id` text,
	`handle` text,
	`max_videos` integer DEFAULT 50,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sources_type_idx` ON `sources` (`type`);
