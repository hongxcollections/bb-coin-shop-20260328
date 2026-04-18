-- Migration 0014: Add columns using standard MySQL syntax (0013 used MariaDB-only IF NOT EXISTS syntax which silently failed on MySQL 8)

-- Add warningDeposit to seller_deposits
ALTER TABLE `seller_deposits` ADD COLUMN `warningDeposit` decimal(12,2) NOT NULL DEFAULT 1000.00;
--> statement-breakpoint
-- Add remainingQuota to user_subscriptions
ALTER TABLE `user_subscriptions` ADD COLUMN `remainingQuota` int NOT NULL DEFAULT 0;
