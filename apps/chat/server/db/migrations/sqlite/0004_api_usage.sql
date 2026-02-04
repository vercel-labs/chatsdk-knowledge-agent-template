-- Add source field to messages table
ALTER TABLE `messages` ADD `source` text DEFAULT 'web';--> statement-breakpoint

-- Create api_usage table for external API tracking (SDK, GitHub bot, etc.)
CREATE TABLE `api_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_id` text,
	`model` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`duration_ms` integer,
	`metadata` text,
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `api_usage_source_idx` ON `api_usage` (`source`);--> statement-breakpoint
CREATE INDEX `api_usage_created_at_idx` ON `api_usage` (`created_at`);--> statement-breakpoint

-- Add source field to usage_stats table
ALTER TABLE `usage_stats` ADD `source` text DEFAULT 'web' NOT NULL;--> statement-breakpoint

-- Drop old unique index and create new one with source
DROP INDEX IF EXISTS `usage_stats_date_user_model_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `usage_stats_date_user_source_model_idx` ON `usage_stats` (`date`,`user_id`,`source`,`model`);
