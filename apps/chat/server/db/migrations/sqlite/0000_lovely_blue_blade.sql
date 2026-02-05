CREATE TABLE `agent_config` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'default' NOT NULL,
	`additional_prompt` text,
	`response_style` text DEFAULT 'concise',
	`language` text DEFAULT 'en',
	`default_model` text,
	`max_steps_multiplier` real DEFAULT 1,
	`temperature` real DEFAULT 0.7,
	`search_instructions` text,
	`citation_format` text DEFAULT 'inline',
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX `api_usage_source_idx` ON `api_usage` (`source`);--> statement-breakpoint
CREATE INDEX `api_usage_created_at_idx` ON `api_usage` (`created_at`);--> statement-breakpoint
CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`user_id` text NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`share_token` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chats_user_id_idx` ON `chats` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chats_share_token_idx` ON `chats` (`share_token`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`role` text NOT NULL,
	`parts` text,
	`feedback` text,
	`model` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`duration_ms` integer,
	`source` text DEFAULT 'web',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_chat_id_idx` ON `messages` (`chat_id`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`base_path` text DEFAULT '/docs',
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
CREATE INDEX `sources_type_idx` ON `sources` (`type`);--> statement-breakpoint
CREATE TABLE `usage_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`user_id` text,
	`source` text DEFAULT 'web' NOT NULL,
	`model` text NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`total_input_tokens` integer DEFAULT 0 NOT NULL,
	`total_output_tokens` integer DEFAULT 0 NOT NULL,
	`total_duration_ms` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `usage_stats_date_idx` ON `usage_stats` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `usage_stats_date_user_source_model_idx` ON `usage_stats` (`date`,`user_id`,`source`,`model`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text NOT NULL,
	`username` text NOT NULL,
	`provider` text NOT NULL,
	`provider_id` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_provider_id_idx` ON `users` (`provider`,`provider_id`);