ALTER TABLE `auctions` MODIFY COLUMN `status` enum('active','ended','cancelled','draft') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `auctions` ADD `fbPostUrl` text;