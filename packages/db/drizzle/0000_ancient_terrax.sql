CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'Inbox' NOT NULL,
	`context` text,
	`priority` text DEFAULT 'P3',
	`due_at` text,
	`start_at` text,
	`completed_at` text,
	`estimate` integer,
	`order_index` text NOT NULL,
	`is_focus` integer DEFAULT false NOT NULL,
	`created_by` text DEFAULT 'web_ui' NOT NULL,
	`agent_id` text,
	`source_message_id` text,
	`request_id` text,
	`reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_priority_idx` ON `tasks` (`priority`);--> statement-breakpoint
CREATE INDEX `tasks_due_at_idx` ON `tasks` (`due_at`);--> statement-breakpoint
CREATE INDEX `tasks_is_focus_idx` ON `tasks` (`is_focus`);--> statement-breakpoint
CREATE INDEX `tasks_context_idx` ON `tasks` (`context`);--> statement-breakpoint
CREATE INDEX `tasks_order_idx` ON `tasks` (`order_index`);--> statement-breakpoint
CREATE TABLE `subtasks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`order_index` text NOT NULL,
	`created_by` text DEFAULT 'web_ui' NOT NULL,
	`agent_id` text,
	`request_id` text,
	`reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique_idx` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `task_tags` (
	`task_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_tags_unique_idx` ON `task_tags` (`task_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`filter_definition` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_type` text DEFAULT 'user' NOT NULL,
	`agent_id` text,
	`request_id` text,
	`before` text,
	`after` text,
	`reason` text,
	`undone` integer DEFAULT false NOT NULL,
	`undone_by_audit_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_request_id_idx` ON `audit_log` (`request_id`);--> statement-breakpoint
CREATE INDEX `audit_created_at_idx` ON `audit_log` (`created_at`);