CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_config" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'default' NOT NULL,
	"additional_prompt" text,
	"response_style" text DEFAULT 'concise',
	"language" text DEFAULT 'en',
	"default_model" text,
	"max_steps_multiplier" real DEFAULT 1,
	"temperature" real DEFAULT 0.7,
	"search_instructions" text,
	"citation_format" text DEFAULT 'inline',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"duration_ms" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apikey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"userId" text NOT NULL,
	"refillInterval" integer,
	"refillAmount" integer,
	"lastRefillAt" timestamp,
	"enabled" boolean DEFAULT true,
	"rateLimitEnabled" boolean DEFAULT true,
	"rateLimitTimeWindow" integer DEFAULT 86400000,
	"rateLimitMax" integer DEFAULT 10,
	"requestCount" integer DEFAULT 0,
	"remaining" integer,
	"lastRequest" timestamp,
	"expiresAt" timestamp,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"user_id" text NOT NULL,
	"mode" text DEFAULT 'chat' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"share_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evlog_events" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" text NOT NULL,
	"level" text NOT NULL,
	"service" text NOT NULL,
	"environment" text NOT NULL,
	"method" text,
	"path" text,
	"status" integer,
	"duration_ms" integer,
	"request_id" text,
	"source" text,
	"error" jsonb,
	"data" jsonb,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb,
	"feedback" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"duration_ms" integer,
	"source" text DEFAULT 'web',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"impersonatedBy" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"base_path" text DEFAULT '/docs',
	"repo" text,
	"branch" text,
	"content_path" text,
	"output_path" text,
	"readme_only" boolean DEFAULT false,
	"channel_id" text,
	"handle" text,
	"max_videos" integer DEFAULT 50,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"user_id" text,
	"source" text DEFAULT 'web' NOT NULL,
	"model" text NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"total_input_tokens" integer DEFAULT 0 NOT NULL,
	"total_output_tokens" integer DEFAULT 0 NOT NULL,
	"total_duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"banReason" text,
	"banExpires" timestamp,
	"username" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "api_usage_source_idx" ON "api_usage" USING btree ("source");--> statement-breakpoint
CREATE INDEX "api_usage_created_at_idx" ON "api_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "apikey_key_idx" ON "apikey" USING btree ("key");--> statement-breakpoint
CREATE INDEX "apikey_userId_idx" ON "apikey" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "chats_user_id_idx" ON "chats" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chats_share_token_idx" ON "chats" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "evlog_events_timestamp_idx" ON "evlog_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "evlog_events_level_idx" ON "evlog_events" USING btree ("level");--> statement-breakpoint
CREATE INDEX "evlog_events_service_idx" ON "evlog_events" USING btree ("service");--> statement-breakpoint
CREATE INDEX "evlog_events_status_idx" ON "evlog_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "evlog_events_request_id_idx" ON "evlog_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "evlog_events_created_at_idx" ON "evlog_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "messages_chat_id_idx" ON "messages" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "sources_type_idx" ON "sources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "usage_stats_date_idx" ON "usage_stats" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_stats_date_user_source_model_idx" ON "usage_stats" USING btree ("date","user_id","source","model");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");