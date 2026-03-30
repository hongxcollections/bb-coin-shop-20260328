CREATE TABLE `favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`auctionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificationSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`senderName` varchar(128) NOT NULL DEFAULT '大BB錢幣店',
	`senderEmail` varchar(320) NOT NULL DEFAULT 'ywkyee@gmail.com',
	`enableOutbid` int NOT NULL DEFAULT 1,
	`enableWon` int NOT NULL DEFAULT 1,
	`enableEndingSoon` int NOT NULL DEFAULT 1,
	`endingSoonMinutes` int NOT NULL DEFAULT 60,
	`enableAntiSnipe` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notificationSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proxyBidLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auctionId` int NOT NULL,
	`round` int NOT NULL DEFAULT 1,
	`triggerUserId` int NOT NULL,
	`triggerAmount` decimal(10,2) NOT NULL,
	`proxyUserId` int NOT NULL,
	`proxyAmount` decimal(10,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proxyBidLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proxyBids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auctionId` int NOT NULL,
	`userId` int NOT NULL,
	`maxAmount` decimal(10,2) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proxyBids_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `auctions` ADD `relistSourceId` int;--> statement-breakpoint
ALTER TABLE `auctions` ADD `archived` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `auctions` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `auctions` ADD `category` enum('古幣','紀念幣','外幣','銀幣','金幣','其他') DEFAULT '其他';--> statement-breakpoint
ALTER TABLE `auctions` ADD `antiSnipeEnabled` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `auctions` ADD `antiSnipeMinutes` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `auctions` ADD `extendMinutes` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `auctions` ADD `antiSnipeMemberLevels` text;--> statement-breakpoint
ALTER TABLE `bids` ADD `isAnonymous` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notifyOutbid` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notifyWon` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notifyEndingSoon` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `memberLevel` enum('bronze','silver','gold','vip') DEFAULT 'bronze' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `defaultAnonymous` int DEFAULT 0 NOT NULL;