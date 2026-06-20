CREATE TABLE "blobs" (
	"session_id" text NOT NULL,
	"hash" text NOT NULL,
	"content" text NOT NULL,
	"size" integer NOT NULL,
	"binary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "blobs_session_id_hash_pk" PRIMARY KEY("session_id","hash"),
	CONSTRAINT "blobs_size_chk" CHECK ("blobs"."size" >= 0)
);
--> statement-breakpoint
CREATE TABLE "checkpoint_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"checkpoint_seq" integer NOT NULL,
	"path" text NOT NULL,
	"change_type" text NOT NULL,
	"old_path" text,
	"before_hash" text,
	"after_hash" text,
	"additions" integer DEFAULT 0 NOT NULL,
	"deletions" integer DEFAULT 0 NOT NULL,
	"binary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "checkpoint_changes_type_chk" CHECK ("checkpoint_changes"."change_type" in ('added', 'modified', 'deleted', 'renamed')),
	CONSTRAINT "checkpoint_changes_after_hash_chk" CHECK (("checkpoint_changes"."change_type" = 'deleted') = ("checkpoint_changes"."after_hash" is null)),
	CONSTRAINT "checkpoint_changes_counts_chk" CHECK ("checkpoint_changes"."additions" >= 0 and "checkpoint_changes"."deletions" >= 0)
);
--> statement-breakpoint
CREATE TABLE "checkpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"seq" integer NOT NULL,
	"label" text NOT NULL,
	"additions" integer DEFAULT 0 NOT NULL,
	"deletions" integer DEFAULT 0 NOT NULL,
	"files_changed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkpoints_session_seq" UNIQUE("session_id","seq"),
	CONSTRAINT "checkpoints_counts_chk" CHECK ("checkpoints"."seq" >= 0 and "checkpoints"."additions" >= 0 and "checkpoints"."deletions" >= 0 and "checkpoints"."files_changed" >= 0)
);
--> statement-breakpoint
CREATE TABLE "files" (
	"session_id" text NOT NULL,
	"path" text NOT NULL,
	"hash" text NOT NULL,
	"size" integer NOT NULL,
	"binary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "files_session_id_path_pk" PRIMARY KEY("session_id","path"),
	CONSTRAINT "files_size_chk" CHECK ("files"."size" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "sessions_status_chk" CHECK ("sessions"."status" in ('active', 'ended'))
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"session_id" text PRIMARY KEY NOT NULL,
	"tree" jsonb NOT NULL,
	"sequence_num" integer DEFAULT 0 NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snapshots_sequence_num_chk" CHECK ("snapshots"."sequence_num" >= 0)
);
--> statement-breakpoint
ALTER TABLE "blobs" ADD CONSTRAINT "blobs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoint_changes" ADD CONSTRAINT "checkpoint_changes_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoint_changes" ADD CONSTRAINT "checkpoint_changes_ckpt_fk" FOREIGN KEY ("session_id","checkpoint_seq") REFERENCES "public"."checkpoints"("session_id","seq") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_blob_fk" FOREIGN KEY ("session_id","hash") REFERENCES "public"."blobs"("session_id","hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkpoint_changes_session_seq" ON "checkpoint_changes" USING btree ("session_id","checkpoint_seq");--> statement-breakpoint
CREATE INDEX "checkpoint_changes_session_path_seq" ON "checkpoint_changes" USING btree ("session_id","path","checkpoint_seq");