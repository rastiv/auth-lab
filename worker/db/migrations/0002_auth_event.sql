CREATE TABLE `auth_event` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`method` text,
	`device` text,
	`city` text,
	`country` text,
	`network` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_event_userId_createdAt_idx` ON `auth_event` (`user_id`,`created_at`);