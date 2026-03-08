-- Remove captures feature
DELETE FROM "audit_log" WHERE "entity_type" = 'capture';--> statement-breakpoint
DROP TABLE IF EXISTS "capture_tags";--> statement-breakpoint
DROP TABLE IF EXISTS "captures";--> statement-breakpoint
DROP TYPE IF EXISTS "capture_status";--> statement-breakpoint
DELETE FROM "saved_views" WHERE "type" = 'Captures';
