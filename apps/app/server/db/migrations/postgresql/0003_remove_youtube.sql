DELETE FROM "sources" WHERE "type" = 'youtube';--> statement-breakpoint
ALTER TABLE "sources" DROP COLUMN IF EXISTS "channel_id";--> statement-breakpoint
ALTER TABLE "sources" DROP COLUMN IF EXISTS "handle";--> statement-breakpoint
ALTER TABLE "sources" DROP COLUMN IF EXISTS "max_videos";