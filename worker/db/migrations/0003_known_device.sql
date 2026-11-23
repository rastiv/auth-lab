CREATE TABLE `known_device` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `known_device_userId_tokenHash_idx` ON `known_device` (`user_id`,`token_hash`);--> statement-breakpoint
ALTER TABLE `user` ADD `new_device_alerts` integer DEFAULT true;