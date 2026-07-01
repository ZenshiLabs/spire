ALTER TABLE "sessions" ADD COLUMN "group_id" text;--> statement-breakpoint
CREATE INDEX "sessions_group_id" ON "sessions" USING btree ("group_id");