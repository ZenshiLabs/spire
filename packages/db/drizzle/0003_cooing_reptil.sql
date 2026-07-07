-- Convert blobs.content from text to bytea, preserving existing rows as their
-- raw UTF-8 bytes (compression = 'none'). drizzle-kit cannot generate a valid
-- text->bytea cast, so this statement is hand-written.
ALTER TABLE "blobs" ALTER COLUMN "content" SET DATA TYPE bytea USING convert_to("content", 'UTF8');--> statement-breakpoint
ALTER TABLE "blobs" ADD COLUMN "compression" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
-- Stored bytes are already brotli-compressed for most rows; skip Postgres' own
-- pglz pass on this column so it doesn't waste cycles trying to recompress them.
ALTER TABLE "blobs" ALTER COLUMN "content" SET STORAGE EXTERNAL;
