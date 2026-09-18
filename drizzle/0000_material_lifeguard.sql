CREATE TABLE `temp_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`share_id` text NOT NULL,
	`object_key` text NOT NULL,
	`original_file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	`expires_at` integer NOT NULL,
	`retention_minutes` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `temp_files_share_id_unique` ON `temp_files` (`share_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `temp_files_object_key_unique` ON `temp_files` (`object_key`);