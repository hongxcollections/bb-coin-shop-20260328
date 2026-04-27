CREATE TABLE `ad_banners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetType` enum('guest','member','merchant') NOT NULL,
	`slot` int NOT NULL,
	`title` varchar(200),
	`body` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ad_banners_id` PRIMARY KEY(`id`)
);
