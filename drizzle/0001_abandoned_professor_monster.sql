CREATE TABLE `auctionImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auctionId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auctionImages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auctions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`startingPrice` decimal(10,2) NOT NULL,
	`currentPrice` decimal(10,2) NOT NULL,
	`highestBidderId` int,
	`endTime` timestamp NOT NULL,
	`status` enum('active','ended','cancelled') NOT NULL DEFAULT 'active',
	`bidIncrement` int NOT NULL DEFAULT 30,
	`currency` enum('HKD','USD','CNY','GBP','EUR','JPY') NOT NULL DEFAULT 'HKD',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auctions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auctionId` int NOT NULL,
	`userId` int NOT NULL,
	`bidAmount` decimal(10,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bids_id` PRIMARY KEY(`id`)
);
