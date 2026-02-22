-- Add tsvector generated columns for full-text search
ALTER TABLE "tasks" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(notes, ''))) STORED;--> statement-breakpoint

ALTER TABLE "captures" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) STORED;--> statement-breakpoint

-- GIN indexes for fast full-text search
CREATE INDEX "tasks_search_idx" ON "tasks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "captures_search_idx" ON "captures" USING gin ("search_vector");
