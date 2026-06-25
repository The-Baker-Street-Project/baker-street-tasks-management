CREATE TABLE `areas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`order_index` text NOT NULL,
	`created_by` text DEFAULT 'web_ui' NOT NULL,
	`agent_id` text,
	`request_id` text,
	`reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `areas_name_unique_idx` ON `areas` (`name`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`area_id` text,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`order_index` text NOT NULL,
	`created_by` text DEFAULT 'web_ui' NOT NULL,
	`agent_id` text,
	`request_id` text,
	`reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_area_name_unique_idx` ON `projects` (`area_id`,`name`);--> statement-breakpoint
CREATE TABLE `task_projects` (
	`task_id` text NOT NULL,
	`project_id` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_projects_unique_idx` ON `task_projects` (`task_id`,`project_id`);