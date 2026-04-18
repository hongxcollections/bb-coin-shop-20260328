-- Migration 0013: quota system, warning deposit, commission refund requests
-- Note: Uses standard MySQL syntax (no ADD COLUMN IF NOT EXISTS - that is MariaDB-only)

-- 1. Add warningDeposit to seller_deposits
ALTER TABLE `seller_deposits` ADD COLUMN `warningDeposit` decimal(12,2) NOT NULL DEFAULT 1000.00;
--> statement-breakpoint
-- 2. Add remainingQuota to user_subscriptions
ALTER TABLE `user_subscriptions` ADD COLUMN `remainingQuota` int NOT NULL DEFAULT 0;
--> statement-breakpoint
-- 3. Create commissionRefundRequests table
CREATE TABLE IF NOT EXISTS `commissionRefundRequests` (
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
