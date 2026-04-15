CREATE TABLE `deposit_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`depositId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('top_up','commission','refund','adjustment') NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`balanceAfter` decimal(12,2) NOT NULL,
	`description` text,
	`relatedAuctionId` int,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deposit_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seller_deposits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` decimal(12,2) NOT NULL DEFAULT '0.00',
	`requiredDeposit` decimal(12,2) NOT NULL DEFAULT '500.00',
	`commissionRate` decimal(5,4) NOT NULL DEFAULT '0.0500',
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seller_deposits_id` PRIMARY KEY(`id`),
	CONSTRAINT `seller_deposits_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`memberLevel` enum('bronze','silver','gold','vip') NOT NULL,
	`monthlyPrice` decimal(10,2) NOT NULL DEFAULT '0.00',
	`yearlyPrice` decimal(10,2) NOT NULL DEFAULT '0.00',
	`maxListings` int NOT NULL DEFAULT 0,
	`commissionDiscount` decimal(5,4) NOT NULL DEFAULT '0.0000',
	`description` text,
	`benefits` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planId` int NOT NULL,
	`billingCycle` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
	`status` enum('pending','active','expired','cancelled','rejected') NOT NULL DEFAULT 'pending',
	`startDate` timestamp,
	`endDate` timestamp,
	`paymentMethod` varchar(100),
	`paymentReference` varchar(255),
	`paymentProofUrl` text,
	`adminNote` text,
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `password` varchar(255);