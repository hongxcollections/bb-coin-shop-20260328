ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `password` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `loginMethod` varchar(20) DEFAULT 'google';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sellerDeposits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` decimal(10,2) NOT NULL DEFAULT '0.00',
	`totalDeposited` decimal(10,2) NOT NULL DEFAULT '0.00',
	`totalDeducted` decimal(10,2) NOT NULL DEFAULT '0.00',
	`totalRefunded` decimal(10,2) NOT NULL DEFAULT '0.00',
	`requiredDeposit` decimal(10,2) NOT NULL DEFAULT '500.00',
	`commissionRate` decimal(5,4) NOT NULL DEFAULT '0.0500',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sellerDeposits_id` PRIMARY KEY(`id`),
	CONSTRAINT `sellerDeposits_userId_unique` UNIQUE(`userId`)
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `depositTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`depositId` int NOT NULL,
	`type` varchar(20) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`balanceAfter` decimal(10,2) NOT NULL,
	`description` text,
	`relatedAuctionId` int,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `depositTransactions_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscriptionPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`monthlyPrice` decimal(10,2) NOT NULL DEFAULT '0.00',
	`yearlyPrice` decimal(10,2) NOT NULL DEFAULT '0.00',
	`memberLevel` varchar(20) NOT NULL DEFAULT 'bronze',
	`commissionDiscount` decimal(5,4) NOT NULL DEFAULT '0.0000',
	`maxListings` int NOT NULL DEFAULT 10,
	`features` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptionPlans_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `userSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planId` int NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`billingCycle` varchar(20) NOT NULL DEFAULT 'monthly',
	`startDate` timestamp,
	`endDate` timestamp,
	`paymentReference` varchar(255),
	`adminNote` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSubscriptions_id` PRIMARY KEY(`id`)
);
