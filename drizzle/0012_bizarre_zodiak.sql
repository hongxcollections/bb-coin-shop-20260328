CREATE TABLE `commissionRefundRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auctionId` int NOT NULL,
	`userId` int NOT NULL,
	`commissionAmount` decimal(12,2) NOT NULL,
	`reason` enum('buyer_missing','buyer_refused','mutual_cancel','other') NOT NULL,
	`reasonDetail` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`adminNote` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commissionRefundRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dailyEarlyBird` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`claimDate` varchar(10) NOT NULL,
	`trialLevel` varchar(20) NOT NULL,
	`trialExpiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dailyEarlyBird_id` PRIMARY KEY(`id`),
	CONSTRAINT `dailyEarlyBird_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `depositTierPresets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`maintenancePct` decimal(5,2) NOT NULL DEFAULT '80.00',
	`warningPct` decimal(5,2) NOT NULL DEFAULT '60.00',
	`commissionRate` decimal(5,4) NOT NULL DEFAULT '0.0500',
	`productCommissionRate` decimal(5,4) NOT NULL DEFAULT '0.0500',
	`description` text,
	`isActive` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `depositTierPresets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `depositTopUpRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tierId` int,
	`amount` decimal(12,2) NOT NULL,
	`referenceNo` varchar(100) NOT NULL,
	`bank` varchar(100),
	`note` text,
	`receiptUrl` varchar(500),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`adminNote` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `depositTopUpRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `featuredListings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`merchantId` int NOT NULL,
	`productId` int NOT NULL,
	`productTitle` varchar(200) NOT NULL,
	`merchantName` varchar(100) NOT NULL,
	`tier` enum('day1','day3','day7') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`status` enum('active','queued','expired','cancelled') NOT NULL DEFAULT 'active',
	`startAt` timestamp NOT NULL DEFAULT (now()),
	`endAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `featuredListings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merchantApplications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contactName` varchar(100),
	`merchantName` varchar(100) NOT NULL,
	`selfIntro` text NOT NULL,
	`whatsapp` varchar(30) NOT NULL,
	`facebook` varchar(500),
	`yearsExperience` varchar(20),
	`merchantIcon` varchar(500),
	`categories` text,
	`samplePhotos` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merchantApplications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merchantProducts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`merchantId` int NOT NULL,
	`merchantName` varchar(100) NOT NULL,
	`merchantIcon` varchar(500),
	`whatsapp` varchar(30),
	`title` varchar(200) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'HKD',
	`category` varchar(500),
	`images` text,
	`stock` int NOT NULL DEFAULT 1,
	`status` enum('active','sold','hidden') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merchantProducts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pushSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpoint` varchar(500) NOT NULL,
	`p256dh` varchar(255) NOT NULL,
	`auth` varchar(100) NOT NULL,
	`userAgent` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pushSubscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pushSubscriptions_endpoint_unique` UNIQUE(`endpoint`)
);
--> statement-breakpoint
CREATE TABLE `userAutoBidQuota` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`monthKey` varchar(7) NOT NULL,
	`used` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userAutoBidQuota_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `seller_deposits` ADD `warningDeposit` decimal(12,2) DEFAULT '1000.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `seller_deposits` ADD `productCommissionRate` decimal(5,4) DEFAULT '0.0500' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD `remainingQuota` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `memberLevelExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `mustChangePassword` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `isBanned` int DEFAULT 0 NOT NULL;