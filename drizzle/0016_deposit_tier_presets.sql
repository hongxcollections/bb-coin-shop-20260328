-- Safe migration: create depositTierPresets table
CREATE TABLE IF NOT EXISTS `depositTierPresets` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(100) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `maintenancePct` decimal(5,2) NOT NULL DEFAULT 80.00,
  `warningPct` decimal(5,2) NOT NULL DEFAULT 60.00,
  `description` text NULL,
  `isActive` int NOT NULL DEFAULT 1,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `depositTierPresets_id` PRIMARY KEY(`id`)
);
