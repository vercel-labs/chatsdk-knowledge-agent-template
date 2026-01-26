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