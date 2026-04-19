-- Safe migration: create depositTopUpRequests table
CREATE TABLE IF NOT EXISTS `depositTopUpRequests` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `referenceNo` varchar(100) NOT NULL,
  `bank` varchar(100) NULL,
  `note` text NULL,
  `receiptUrl` varchar(500) NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `adminNote` text NULL,
  `reviewedBy` int NULL,
  `reviewedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `depositTopUpRequests_id` PRIMARY KEY(`id`)
);
