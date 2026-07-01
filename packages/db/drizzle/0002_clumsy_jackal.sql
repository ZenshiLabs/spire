CREATE INDEX "sessions_status_updated" ON "sessions" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "sessions_status_ended" ON "sessions" USING btree ("status","ended_at");