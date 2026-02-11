CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
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
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	`impersonatedBy` text,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`userId`);--> statement-breakpoint
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
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`banReason` text,
	`banExpires` integer,
	`username` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);