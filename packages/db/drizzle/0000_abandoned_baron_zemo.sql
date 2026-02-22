CREATE TYPE "public"."actor_type" AS ENUM('user', 'ai');--> statement-breakpoint
CREATE TYPE "public"."capture_status" AS ENUM('Captured', 'Reviewed', 'Archived');--> statement-breakpoint
CREATE TYPE "public"."context" AS ENUM('Home', 'Work');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('task', 'subtask', 'capture', 'tag', 'saved_view');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('P0', 'P1', 'P2', 'P3');--> statement-breakpoint
CREATE TYPE "public"."saved_view_type" AS ENUM('Tasks', 'Captures', 'KanbanLane');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('web_ui', 'mcp');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('Inbox', 'Active', 'Someday', 'Done', 'Archived');--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"status" "task_status" DEFAULT 'Inbox' NOT NULL,
	"context" "context",
	"priority" "priority" DEFAULT 'P3',
	"due_at" timestamp with time zone,
	"start_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"estimate" integer,
	"order_index" text NOT NULL,
	"is_focus" boolean DEFAULT false NOT NULL,
	"created_by" "source" DEFAULT 'web_ui' NOT NULL,
	"agent_id" text,
	"source_message_id" text,
	"request_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"order_index" text NOT NULL,
	"created_by" "source" DEFAULT 'web_ui' NOT NULL,
	"agent_id" text,
	"request_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"status" "capture_status" DEFAULT 'Captured' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"context" "context",
	"source" "source" DEFAULT 'web_ui' NOT NULL,
	"nudge_at" timestamp with time zone,
	"created_by" "source" DEFAULT 'web_ui' NOT NULL,
	"agent_id" text,
	"source_message_id" text,
	"request_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capture_tags" (
	"capture_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_tags" (
	"task_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "saved_view_type" NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"filter_definition" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_type" "actor_type" DEFAULT 'user' NOT NULL,
	"agent_id" text,
	"request_id" text,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"undone" boolean DEFAULT false NOT NULL,
	"undone_by_audit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_tags" ADD CONSTRAINT "capture_tags_capture_id_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_tags" ADD CONSTRAINT "capture_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_priority_idx" ON "tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "tasks_due_at_idx" ON "tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "tasks_is_focus_idx" ON "tasks" USING btree ("is_focus");--> statement-breakpoint
CREATE INDEX "tasks_context_idx" ON "tasks" USING btree ("context");--> statement-breakpoint
CREATE INDEX "tasks_order_idx" ON "tasks" USING btree ("order_index");--> statement-breakpoint
CREATE INDEX "captures_status_idx" ON "captures" USING btree ("status");--> statement-breakpoint
CREATE INDEX "captures_pinned_idx" ON "captures" USING btree ("pinned");--> statement-breakpoint
CREATE INDEX "captures_context_idx" ON "captures" USING btree ("context");--> statement-breakpoint
CREATE UNIQUE INDEX "capture_tags_unique_idx" ON "capture_tags" USING btree ("capture_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_unique_idx" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "task_tags_unique_idx" ON "task_tags" USING btree ("task_id","tag_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_request_id_idx" ON "audit_log" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "audit_created_at_idx" ON "audit_log" USING btree ("created_at");